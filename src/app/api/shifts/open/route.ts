import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiSession } from "@/lib/api-session";

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

    // Prevent duplicate shifts
    const existing = await prisma.shift.findFirst({
      where: {
        storeId: session.storeId,
        status: "OPEN",
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Shift already open" },
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
          detail: `Shift opened with ${activePacks.length} active display pack(s)`,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      shiftId: shift.id,
    });

  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Failed to open shift" },
      { status: 500 }
    );
  }
}