import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const storeId = "DEFAULT_STORE"; // replace with auth store

    // 1. Prevent duplicate open shift
    const existing = await prisma.shift.findFirst({
      where: {
        storeId,
        status: "OPEN",
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Shift already open" },
        { status: 400 }
      );
    }

    // 2. Get all ACTIVE packs on display
    const activePacks = await prisma.pack.findMany({
      where: {
        storeId,
        status: "ACTIVE",
      },
      include: {
        game: true,
      },
    });

    if (activePacks.length === 0) {
      return NextResponse.json(
        { error: "No active packs found" },
        { status: 400 }
      );
    }

    // 3. Create Shift
    const shift = await prisma.shift.create({
      data: {
        storeId,
        status: "OPEN",
        openedById: "SYSTEM",
      },
    });

    // 4. Create Shift Lines (snapshot)
    await prisma.shiftLine.createMany({
      data: activePacks.map((pack: any) => ({
        shiftId: shift.id,
        packId: pack.id,
        slotNumber: "AUTO",
        beginningTicket: pack.currentTicketNumber ?? 0,
      })),
    });

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