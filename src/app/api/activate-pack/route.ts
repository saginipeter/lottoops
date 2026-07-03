import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { slotId, packId } = await req.json();

    if (!slotId || !packId) {
      return NextResponse.json(
        { error: "Missing slotId or packId" },
        { status: 400 }
      );
    }

    // 1. Get slot
    const slot = await prisma.displaySlot.findUnique({
      where: { id: slotId },
    });

    if (!slot) {
      return NextResponse.json(
        { error: "Slot not found" },
        { status: 404 }
      );
    }

    // 2. Get pack
    const pack = await prisma.pack.findUnique({
      where: { id: packId },
    });

    if (!pack) {
      return NextResponse.json(
        { error: "Pack not found" },
        { status: 404 }
      );
    }

    // 3. Prevent double assignment
    if (slot.packId) {
      return NextResponse.json(
        { error: "Slot already occupied" },
        { status: 400 }
      );
    }

    // 4. Activate pack + assign to slot (CRITICAL FIX)
    await prisma.$transaction([
      prisma.pack.update({
        where: { id: packId },
        data: {
          status: "ACTIVE",
          activatedAt: new Date(),
        },
      }),

      prisma.displaySlot.update({
        where: { id: slotId },
        data: {
          packId: packId,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Activation failed" },
      { status: 500 }
    );
  }
}