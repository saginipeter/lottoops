import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiSession } from "@/lib/api-session";

async function ensureShiftTerminalSchema() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE shifts
    ADD COLUMN IF NOT EXISTS terminal_id TEXT
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_shifts_store_status_terminal
    ON shifts (store_id, status, terminal_id)
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
      WHERE store_id = $1
        AND status = 'OPEN'
        AND COALESCE(terminal_id, 'T1') = $2
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

    if (activePacks.length === 0) {
      return NextResponse.json(
        { error: "No active packs found" },
        { status: 400 }
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
      SET terminal_id = $1
      WHERE id = $2
      `,
      terminalId,
      shift.id
    );

    // Snapshot packs
    await prisma.$transaction([
      prisma.shiftLine.createMany({
        data: activePacks.map((pack: any) => ({
          shiftId: shift.id,
          packId: pack.id,
          slotNumber: pack.slot!.slotNumber,
          beginningTicket:
            pack.currentTicketNumber ??
            pack.firstTicket ??
            0,
        })),
      }),
      prisma.scanLogEntry.create({
        data: {
          storeId: session.storeId,
          action: "SHIFT_OPEN",
          performedById: session.userId,
          detail: `Shift opened on terminal ${terminalId} with ${activePacks.length} active display pack(s)`,
        },
      }),
    ]);

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