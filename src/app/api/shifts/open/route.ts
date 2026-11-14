import { NextRequest, NextResponse } from "next/server";
import { getSessionMaxAge, SESSION_COOKIE, signSession } from "@/lib/session";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getApiSession } from "@/lib/api-session";
import { findUnassignedActivePacks } from "@/lib/core-validation";
import { logInventoryActivity } from "@/lib/activity-log";
import { isManagerOrAbove, isReadOnly } from "@/lib/permissions";
import { getSafeCurrentTicket } from "@/lib/ticket-quantity";
import { getAuditPhysicalTicket } from "@/lib/ticket-quantity";
import { getNextAvailableShiftNumber, parseShiftNumber } from "@/lib/shift-number";
import { normalizeTerminalId } from "@/lib/device-registry";
import { bindLoginSessionToShift, ShiftAssignmentConflict } from "@/lib/shift-session-assignment";

interface ActivePack {
  id: string;
  serialNumber: string;
  currentTicketNumber: number | null;
  firstTicket: number | null;
  ticketQuantity: number | null;
  firstOrLastTicket: string | null;
  slot: { slotNumber: string } | null;
}

function resolveSellableTicket(pack: {
  currentTicketNumber: number | null;
  firstTicket: number | null;
  ticketQuantity: number | null;
}) {
  const currentTicket = getSafeCurrentTicket(pack);
  return currentTicket > 0 ? currentTicket : null;
}

class ShiftOpenError extends Error {}

export async function POST(req: NextRequest) {
  try {
    const session = await getApiSession();

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    if (isReadOnly(session)) return NextResponse.json({ error: "Auditor accounts are read-only." }, { status: 403 });
    const staffCanOpen = session.role === "EMPLOYEE" || session.role === "SHIFT_LEAD";
    if (!isManagerOrAbove(session) && !staffCanOpen) {
      return NextResponse.json({ error: "You are not authorized to open a numbered shift." }, { status: 403 });
    }
    if (!prisma) {
      return NextResponse.json(
        { error: "Database not connected" },
        { status: 503 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const terminalId = body?.terminalId === undefined ? "T1" : normalizeTerminalId(body.terminalId);
    if (!terminalId) return NextResponse.json({ error: "Choose a registered terminal such as T1 or T2." }, { status: 400 });
    const requestedShiftId = typeof body?.shiftId === "string" ? body.shiftId.trim() : "";
    const requestedShiftNumber = body?.shiftNumber === undefined ? null : parseShiftNumber(body.shiftNumber);
    if (body?.shiftNumber !== undefined && requestedShiftNumber === null) {
      return NextResponse.json({ error: "Choose Shift 1 or Shift 2." }, { status: 400 });
    }
    try {
      const registeredRows = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS count FROM store_devices WHERE store_id = $1`, session.storeId) as Array<{ count: number }>;
      if (Number(registeredRows[0]?.count ?? 0) > 0) {
        const activeRows = await prisma.$queryRawUnsafe(`SELECT id FROM store_devices WHERE store_id = $1 AND terminal_id = $2 AND active = TRUE LIMIT 1`, session.storeId, terminalId) as Array<{ id: string }>;
        if (activeRows.length === 0) {
          return NextResponse.json({ error: `Terminal ${terminalId} is not registered or is inactive for this store.` }, { status: 403 });
        }
      } else if (terminalId !== "T1" && terminalId !== "T2") {
        return NextResponse.json({ error: `Terminal ${terminalId} is not authorized for this store.` }, { status: 403 });
      }
    } catch {
      // A legacy store without a device registry may use the standard T1/T2 labels.
      if (terminalId !== "T1" && terminalId !== "T2") {
        return NextResponse.json({ error: `Terminal ${terminalId} is not authorized for this store.` }, { status: 403 });
      }
    }

    if (requestedShiftId) {
      const selected = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const rows = await tx.$queryRawUnsafe<Array<{ id: string; shiftNumber: number | null; terminalId: string | null }>>(
          `SELECT id, shift_number AS "shiftNumber", "terminalId"
           FROM shifts WHERE id = $1 AND "storeId" = $2 AND status = 'OPEN' FOR UPDATE`,
          requestedShiftId,
          session.storeId,
        );
        const openShift = rows[0];
        const shiftNumber = parseShiftNumber(openShift?.shiftNumber);
        if (!openShift || !shiftNumber || !openShift.terminalId) {
          throw new ShiftOpenError("That shift is no longer open. Refresh and choose an available shift.");
        }
        if (openShift.terminalId !== terminalId) {
          throw new ShiftOpenError("The selected shift does not belong to the chosen terminal.");
        }
        const loginSessionId = await bindLoginSessionToShift(tx, session, { id: openShift.id, terminalId });
        return { shiftId: openShift.id, shiftNumber, terminalId, loginSessionId };
      }, { isolationLevel: "Serializable" });
      return respondWithShift(session, selected);
    }

    const existingRows: Array<{ id: string; shiftNumber: number | null }> = await prisma.shift.findMany({
      where: { storeId: session.storeId, terminalId, status: "OPEN", shiftNumber: { in: [1, 2] } },
      select: { id: true, shiftNumber: true },
    });
    if (existingRows.length >= 2) {
      return NextResponse.json({ error: `Shift 1 and Shift 2 are already open on terminal ${terminalId}.` }, { status: 409 });
    }
    const shiftNumber = requestedShiftNumber ?? getNextAvailableShiftNumber(existingRows.map((shift) => shift.shiftNumber));
    if (shiftNumber === null) return NextResponse.json({ error: "No numbered shift is available." }, { status: 409 });
    if (existingRows.some((shift) => shift.shiftNumber === shiftNumber)) {
      return NextResponse.json({ error: `Shift ${shiftNumber} is already open.` }, { status: 409 });
    }

    // The Shift and its inventory/audit snapshot are atomic and serializable
    // against ticket sales on other concurrent numbered shifts.
    let activePackCount = 0;
    const opened = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Use the same pack-row lock as sales before reading the shared inventory.
      await tx.$queryRawUnsafe(
        `SELECT id FROM packs WHERE "storeId" = $1 AND status = 'ACTIVE' ORDER BY id FOR UPDATE`,
        session.storeId,
      );
      const typedActivePacks = await tx.pack.findMany({
        where: { storeId: session.storeId, status: "ACTIVE" },
        include: { game: true, slot: true },
      }) as ActivePack[];
      const unassignedPacks = findUnassignedActivePacks(typedActivePacks);
      if (unassignedPacks.length > 0) {
        throw new ShiftOpenError("Every active pack must have a display position before opening a shift: " + unassignedPacks.join(", "));
      }
      const invalidPacks = typedActivePacks.filter((pack) => resolveSellableTicket(pack) === null);
      if (invalidPacks.length > 0) {
        throw new ShiftOpenError(
          "Some active packs have invalid ticket state (current/first/quantity). " +
          `Fix before opening shift: ${invalidPacks.map((pack) => pack.serialNumber).join(", ")}`,
        );
      }
      const inconsistentPacks = typedActivePacks.filter((pack) => Number(pack.currentTicketNumber ?? 0) !== resolveSellableTicket(pack));
      if (inconsistentPacks.length > 0) {
        throw new ShiftOpenError(
          "Some active packs have a stored ticket position that needs manager correction before opening: " +
          inconsistentPacks.map((pack) => pack.serialNumber).join(", "),
        );
      }
      activePackCount = typedActivePacks.length;

      const createdShift = await tx.shift.create({
        data: {
          storeId: session.storeId,
          shiftNumber,
          terminalId,
          openedById: session.userId,
          status: "OPEN",
        },
      });

      if (typedActivePacks.length > 0) {
        await tx.shiftLine.createMany({
          data: typedActivePacks.map((pack) => ({
            shiftId: createdShift.id,
            packId: pack.id,
            slotNumber: pack.slot!.slotNumber,
            beginningTicket: resolveSellableTicket(pack)!,
          })),
        });
      }

      await tx.scanLogEntry.create({
        data: {
          storeId: session.storeId,
          action: "SHIFT_OPEN",
          performedById: session.userId,
          detail: `Shift ${shiftNumber} opened on terminal ${terminalId} with ${activePackCount} active display pack(s)`,
        },
      });

      // Every shift starts with a physical audit snapshot. Employees must scan
      // the beginning state before the shift can be used for reconciliation.
      await tx.inventoryAudit.create({
        data: {
          storeId: session.storeId,
          shiftId: createdShift.id,
          begunById: session.userId,
          lines: {
            create: typedActivePacks.map((pack) => ({
              packId: pack.id,
              slotNumber: pack.slot!.slotNumber,
              expectedTicket: getAuditPhysicalTicket({
                currentTicketNumber: resolveSellableTicket(pack),
                firstTicket: pack.firstTicket,
                ticketQuantity: pack.ticketQuantity,
                firstOrLastTicket: pack.firstOrLastTicket,
              }),
            })),
          },
        },
      });

      const loginSessionId = await bindLoginSessionToShift(tx, session, { id: createdShift.id, terminalId });

      return { shift: createdShift, loginSessionId };
    }, { isolationLevel: "Serializable" });
    const shift = opened.shift;

    try {
      await logInventoryActivity({
        storeId: session.storeId,
        action: "SHIFT_OPEN",
        entityType: "SHIFT",
        entityId: shift.id,
        detail: `Shift ${shiftNumber} opened with ${activePackCount} active display pack(s).`,
        performedById: session.userId,
        performedByName: session.name,
        terminalId,
      });
    } catch (activityError) {
      console.warn("Shift opened, but the supplementary activity log could not be written:", activityError);
    }

    return respondWithShift(session, { shiftId: shift.id, shiftNumber, terminalId, loginSessionId: opened.loginSessionId });

  } catch (error) {
    if (error instanceof ShiftOpenError || error instanceof ShiftAssignmentConflict) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error(error);

    const prismaCode = typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code)
      : "";
    if (prismaCode === "P2002") {
      return NextResponse.json({ error: "That numbered shift was opened by another manager. Refresh and choose an available shift." }, { status: 409 });
    }
    if (prismaCode === "P2034") {
      return NextResponse.json({ error: "Shift availability changed while opening. Refresh and try again." }, { status: 409 });
    }

    return NextResponse.json(
      { error: "Failed to open shift" },
      { status: 500 }
    );
  }
}

async function respondWithShift(
  session: NonNullable<Awaited<ReturnType<typeof getApiSession>>>,
  assignment: { shiftId: string; shiftNumber: 1 | 2; terminalId: string; loginSessionId: string | null },
) {
  const response = NextResponse.json({ success: true, ...assignment, loginSessionId: undefined });
  if (session.role === "EMPLOYEE" || session.role === "SHIFT_LEAD") {
    const loginSessionId = assignment.loginSessionId;
    if (!loginSessionId) return NextResponse.json({ error: "Unable to attach this login to the selected shift." }, { status: 500 });
    const token = await signSession({
      ...session,
      shiftId: assignment.shiftId,
      shiftNumber: assignment.shiftNumber,
      terminalId: assignment.terminalId,
      loginSessionId,
    });
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: getSessionMaxAge(session.rememberMe),
      path: "/",
    });
  }
  return response;
}
