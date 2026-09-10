import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiSession } from "@/lib/api-session";
import { findUnassignedActivePacks } from "@/lib/core-validation";
import { logInventoryActivity } from "@/lib/activity-log";
import { recordShiftParticipant } from "@/lib/shift-participants";

interface ActivePack {
  id: string;
  serialNumber: string;
  currentTicketNumber: number | null;
  firstTicket: number | null;
  ticketQuantity: number | null;
  slot: { slotNumber: string } | null;
}

function resolveSellableTicket(pack: {
  currentTicketNumber: number | null;
  firstTicket: number | null;
  ticketQuantity: number | null;
}) {
  const candidates = [pack.currentTicketNumber, pack.firstTicket, pack.ticketQuantity]
    .map((value) => Number(value ?? 0))
    .filter((value) => Number.isFinite(value) && value > 0);

  return candidates.length > 0 ? candidates[0] : null;
}

async function ensureShiftTerminalSchema() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE shifts
    ADD COLUMN IF NOT EXISTS "terminalId" TEXT
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_shifts_store_status_terminal
    ON shifts ("storeId", status, "terminalId")
  `);
}

export async function POST(req: NextRequest) {
  try {
    const session = await getApiSession();

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (!prisma) {
      return NextResponse.json(
        { error: "Database not connected" },
        { status: 503 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const terminalId =
      typeof body?.terminalId === "string" && body.terminalId.trim()
        ? body.terminalId.trim().toUpperCase()
        : "T1";

    await ensureShiftTerminalSchema();

    try {
      const registeredRows = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS count FROM store_devices WHERE store_id = $1`, session.storeId) as Array<{ count: number }>;
      if (Number(registeredRows[0]?.count ?? 0) > 0) {
        const activeRows = await prisma.$queryRawUnsafe(`SELECT id FROM store_devices WHERE store_id = $1 AND terminal_id = $2 AND active = TRUE LIMIT 1`, session.storeId, terminalId) as Array<{ id: string }>;
        if (activeRows.length === 0) {
          return NextResponse.json({ error: `Terminal ${terminalId} is not registered or is inactive for this store.` }, { status: 403 });
        }
      }
    } catch {
      // The registry is optional for legacy stores and initializes on first use.
    }

    // One store has one shared open shift; additional terminals join it.
    const existingRows = (await prisma.$queryRawUnsafe(
      `
      SELECT id
      FROM shifts
      WHERE "storeId" = $1
        AND status = 'OPEN'
      LIMIT 1
      `,
      session.storeId
    )) as { id: string }[];
    const existing = existingRows[0] ?? null;

    if (existing) {
      await recordShiftParticipant(existing.id, session.userId);
      return NextResponse.json(
        { success: true, shiftId: existing.id, terminalId, alreadyOpen: true },
        { status: 200 }
      );
    }

    // Load every active pack so an active pack without a display cannot be
    // silently omitted from the shift opening snapshot.
    const activePacks = await prisma.pack.findMany({
      where: {
        storeId: session.storeId,
        status: "ACTIVE",
      },
      include: {
        game: true,
        slot: true,
      },
    });

    const typedActivePacks = activePacks as ActivePack[];
    const unassignedPacks = findUnassignedActivePacks(typedActivePacks);
    if (unassignedPacks.length > 0) {
      return NextResponse.json(
        {
          error:
            "Every active pack must have a display position before opening a shift: " +
            unassignedPacks.map((pack) => pack.serialNumber).join(", "),
        },
        { status: 409 }
      );
    }
    const invalidPacks = typedActivePacks.filter((pack) => resolveSellableTicket(pack) === null);
    if (invalidPacks.length > 0) {
      return NextResponse.json(
        {
          error:
            "Some active packs have invalid ticket state (current/first/quantity). " +
            `Fix before opening shift: ${invalidPacks.map((pack) => pack.serialNumber).join(", ")}`,
        },
        { status: 409 }
      );
    }

    // Create shift
    const shift = await prisma.shift.create({
      data: {
        storeId: session.storeId,
        openedById: session.userId,
        status: "OPEN",
      },
    });
    await prisma.$executeRawUnsafe(
      `
      UPDATE shifts
      SET "terminalId" = $1
      WHERE id = $2
      `,
      terminalId,
      shift.id
    );

    const txOps: unknown[] = [
      prisma.scanLogEntry.create({
        data: {
          storeId: session.storeId,
          action: "SHIFT_OPEN",
          performedById: session.userId,
          detail: `Shift opened on terminal ${terminalId} with ${activePacks.length} active display pack(s)`,
        },
      }),
    ];

    if (activePacks.length > 0) {
      const repairOps: unknown[] = [];

      for (const pack of typedActivePacks) {
        const beginningTicket = resolveSellableTicket(pack);
        if (beginningTicket === null) continue;
        if (pack.currentTicketNumber && Number(pack.currentTicketNumber) > 0) continue;

        repairOps.push(
          prisma.pack.update({
            where: { id: pack.id },
            data: { currentTicketNumber: beginningTicket },
          })
        );
      }

      txOps.unshift(...repairOps);

      txOps.unshift(
        prisma.shiftLine.createMany({
          data: typedActivePacks.map((pack) => ({
            shiftId: shift.id,
            packId: pack.id,
            slotNumber: pack.slot!.slotNumber,
            beginningTicket: resolveSellableTicket(pack)!,
          })),
        })
      );
    }

    await prisma.$transaction(txOps);

    // Every shift starts with a physical audit snapshot. Employees must scan
    // the beginning state before the shift can be used for reconciliation.
    await prisma.inventoryAudit.create({
      data: {
        storeId: session.storeId,
        shiftId: shift.id,
        begunById: session.userId,
        lines: {
            create: typedActivePacks.map((pack) => ({
            packId: pack.id,
            slotNumber: pack.slot!.slotNumber,
            expectedTicket: resolveSellableTicket(pack)!,
          })),
        },
      },
    });

    await logInventoryActivity({
      storeId: session.storeId,
      action: "SHIFT_OPEN",
      entityType: "SHIFT",
      entityId: shift.id,
      detail: `Shift opened with ${activePacks.length} active display pack(s).`,
      performedById: session.userId,
      performedByName: session.name,
      terminalId,
    });

    return NextResponse.json({
      success: true,
      shiftId: shift.id,
      terminalId,
    });

  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Failed to open shift" },
      { status: 500 }
    );
  }
}