import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiSession } from "@/lib/api-session";

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

    // Prevent duplicate shifts per terminal
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existingRows = (await prisma.$queryRawUnsafe(
      `
      SELECT id
      FROM shifts
      WHERE "storeId" = $1
        AND status = 'OPEN'
        AND COALESCE("terminalId", 'T1') = $2
      LIMIT 1
      `,
      session.storeId,
      terminalId
    )) as { id: string }[];
    const existing = existingRows[0] ?? null;

    if (existing) {
      return NextResponse.json(
        { error: `Shift already open on terminal ${terminalId}` },
        { status: 400 }
      );
    }

    // Load all packs currently on display
    const activePacks = await prisma.pack.findMany({
      where: {
        storeId: session.storeId,
        status: "ACTIVE",
        slot: {
          isNot: null,
        },
      },
      include: {
        game: true,
        slot: true,
      },
    });

    const invalidPacks = activePacks.filter((pack: any) => resolveSellableTicket(pack) === null);
    if (invalidPacks.length > 0) {
      return NextResponse.json(
        {
          error:
            "Some active packs have invalid ticket state (current/first/quantity). " +
            `Fix before opening shift: ${invalidPacks.map((pack: any) => pack.serialNumber).join(", ")}`,
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

    const txOps = [
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
      const repairOps = activePacks
        .map((pack: any) => {
          const beginningTicket = resolveSellableTicket(pack);
          if (beginningTicket === null) return null;
          if (pack.currentTicketNumber && Number(pack.currentTicketNumber) > 0) return null;

          return prisma.pack.update({
            where: { id: pack.id },
            data: { currentTicketNumber: beginningTicket },
          });
        })
        .filter((op): op is ReturnType<typeof prisma.pack.update> => op !== null);

      txOps.unshift(...repairOps);

      txOps.unshift(
        prisma.shiftLine.createMany({
          data: activePacks.map((pack: any) => ({
            shiftId: shift.id,
            packId: pack.id,
            slotNumber: pack.slot!.slotNumber,
            beginningTicket: resolveSellableTicket(pack)!,
          })),
        })
      );
    }

    await prisma.$transaction(txOps);

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