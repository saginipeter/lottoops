import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getApiSession } from "@/lib/api-session";
import { validateEndingTicket } from "@/lib/core-validation";
import { logInventoryActivity } from "@/lib/activity-log";
import { isReadOnly } from "@/lib/permissions";

class CloseError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function POST(req: NextRequest) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (isReadOnly(session)) return NextResponse.json({ error: "Auditor accounts are read-only." }, { status: 403 });
  if (!prisma) return NextResponse.json({ error: "Database not connected" }, { status: 503 });

  try {
    const body = await req.json().catch(() => ({}));
    const shiftId = typeof body?.shiftId === "string" ? body.shiftId.trim() : "";
    const countedCash = Number(body?.countedCash);
    if (!shiftId) return NextResponse.json({ error: "Shift ID is required." }, { status: 400 });
    if ((session.role === "EMPLOYEE" || session.role === "SHIFT_LEAD") && session.shiftId !== shiftId) {
      return NextResponse.json({ error: "You can only close the numbered shift assigned to your current session." }, { status: 403 });
    }
    if (!Number.isFinite(countedCash) || countedCash < 0) {
      return NextResponse.json({ error: "Count the cash drawer before closing this shift." }, { status: 409 });
    }
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Returns and sales lock the shift before packs. Read inventory only after both locks.
      await tx.$queryRawUnsafe(
        `SELECT id FROM shifts WHERE id = $1 AND "storeId" = $2 FOR UPDATE`,
        shiftId, session.storeId,
      );
      await tx.$queryRawUnsafe(`
        SELECT p.id FROM packs p JOIN shift_lines l ON l."packId" = p.id
        WHERE l."shiftId" = $1 AND p."storeId" = $2
        ORDER BY p.id FOR UPDATE OF p
      `, shiftId, session.storeId);
      const shift = await tx.shift.findUnique({
        where: { id: shiftId },
        include: { lines: { include: { pack: { include: { game: true } } } } },
      });
      if (!shift) throw new CloseError("Shift not found.", 404);
      if (shift.storeId !== session.storeId) throw new CloseError("Access denied.", 403);
      if (shift.status !== "OPEN") throw new CloseError("Shift is already closed.", 400);

      const cashRows = await tx.$queryRawUnsafe<Array<{ terminalId: string; openingCash: string | number }>>(`
        SELECT COALESCE("terminalId", 'T1') AS "terminalId",
          COALESCE("openingCash", 0)::numeric AS "openingCash"
        FROM shifts WHERE id = $1 LIMIT 1
      `, shift.id);
      const terminalId = cashRows[0]?.terminalId ?? "T1";
      const openingCash = Number(cashRows[0]?.openingCash ?? 0);
      const audit = await tx.inventoryAudit.findUnique({
        where: { shiftId: shift.id },
        select: {
          id: true, status: true,
          // Only packs still active on a display belong to the closing-audit
          // scope. Packs sold out or removed after opening can retain
          // historical lines without blocking shift close.
          lines: {
            where: { pack: { status: "ACTIVE", slot: { isNot: null } } },
            select: { beginningPhysicalTicket: true, endingPhysicalTicket: true },
          },
        },
      });
      const activeDisplayPackCount = await tx.pack.count({
        where: { storeId: session.storeId, status: "ACTIVE", slot: { isNot: null } },
      });
      const openingAuditIncomplete = !audit || audit.lines.some((line) => line.beginningPhysicalTicket === null);
      const closingAuditIncomplete = Boolean(audit && audit.lines.some((line) => line.endingPhysicalTicket === null));
      if (activeDisplayPackCount > 0 && openingAuditIncomplete) {
        throw new CloseError("Complete the Opening Audit before starting the Closing Audit.", 409);
      }
      if (activeDisplayPackCount > 0 && (closingAuditIncomplete || audit?.status !== "COMPLETED")) {
        throw new CloseError("Complete the Closing Audit before closing this shift.", 409);
      }

      const salesByPackRows = await tx.$queryRawUnsafe<Array<{ packId: string; ticketsSold: number | bigint }>>(
        `SELECT pack_id AS "packId", COUNT(*)::int AS "ticketsSold" FROM live_scan_events WHERE store_id = $1 AND shift_id = $2 GROUP BY pack_id`,
        session.storeId, shift.id,
      );
      const salesByPack = new Map(salesByPackRows.map((row) => [row.packId, Number(row.ticketsSold)]));

      let totalSales = 0;
      let totalTickets = 0;
      for (const line of shift.lines) {
        const beginning = line.beginningTicket;
        const ticketsSold = salesByPack.get(line.packId) ?? 0;
        const sharedCurrent = Number(line.pack.currentTicketNumber ?? 0);
        const firstTicket = Number(line.pack.firstTicket ?? 1);
        const ticketQuantity = Number(line.pack.ticketQuantity ?? line.pack.game.ticketsPerPack ?? 0);
        const maximumRemaining = Math.max(ticketQuantity - firstTicket + 1, 0);
        if (!Number.isInteger(sharedCurrent) || sharedCurrent < 0 || sharedCurrent > maximumRemaining ||
            (line.pack.status === "ACTIVE" && sharedCurrent === 0) || (line.pack.status === "SOLD_OUT" && sharedCurrent !== 0)) {
          throw new CloseError(`The shared ticket position for pack ${line.pack.serialNumber} needs manager correction before closing.`, 409);
        }
        if (!Number.isInteger(beginning) || beginning < 0 || !Number.isInteger(ticketsSold) || ticketsSold < 0 || ticketsSold > beginning) {
          throw new CloseError(`The recorded sales count for pack ${line.pack.serialNumber} exceeds this shift's opening balance.`, 409);
        }
        const ending = beginning - ticketsSold;
        const ticketError = validateEndingTicket(beginning, ending);
        if (ticketError) {
          throw new CloseError(`Invalid shift-local ending ticket for pack ${line.pack.serialNumber}. ${ticketError}`, 409);
        }
        const sales = ticketsSold * Number(line.pack.ticketPrice ?? line.pack.game.price ?? 0);
        totalTickets += ticketsSold;
        totalSales += sales;
        await tx.shiftLine.update({
          where: { id: line.id }, data: { endingTicket: ending, ticketsSold, salesAmount: sales },
        });
      }
      const expectedCash = openingCash + totalSales;
      const cashVariance = countedCash - expectedCash;
      await tx.$executeRawUnsafe(
        `UPDATE shifts SET "expectedCash" = $1, "countedCash" = $2, "cashVariance" = $3, "cashReconciledAt" = NOW(), "cashReconciledById" = $4 WHERE id = $5`,
        expectedCash, countedCash, cashVariance, session.userId, shift.id,
      );
      await tx.shift.update({
        where: { id: shift.id },
        data: { status: "CLOSED", closedAt: new Date(), closedById: session.userId },
      });
      await tx.$executeRawUnsafe(
        `UPDATE login_sessions SET ended_at = COALESCE(ended_at, NOW()) WHERE store_id = $1 AND shift_id = $2 AND ended_at IS NULL`,
        session.storeId, shift.id,
      );
      await tx.scanLogEntry.create({
        data: { storeId: session.storeId, action: "SHIFT_CLOSE", performedById: session.userId, detail: `Shift ${shift.shiftNumber ?? "Unnumbered"} closed on terminal ${terminalId}.` },
      });
      return { terminalId, totalTickets, totalSales, openingCash, expectedCash, countedCash, cashVariance };
    });
    const { terminalId, ...totals } = result;
    await logInventoryActivity({
      storeId: session.storeId, action: "SHIFT_CLOSE", entityType: "SHIFT", entityId: shiftId,
      detail: "Shift closed successfully.", performedById: session.userId,
      performedByName: session.name, terminalId,
    });
    return NextResponse.json({ success: true, ...totals });
  } catch (error) {
    if (error instanceof CloseError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2034") {
      return NextResponse.json({ error: "Shift inventory changed. Refresh before closing again." }, { status: 409 });
    }
    console.error(error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `Unable to close shift. ${message}` }, { status: 500 });
  }
}
