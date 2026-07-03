import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET all display slots
export async function GET() {
  try {
    const slots = await prisma.displaySlot.findMany({
      include: {
        pack: {
          include: {
            game: true,
          },
        },
      },
      orderBy: {
        slotNumber: "asc",
      },
    });

    return NextResponse.json(slots);
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Unable to load display slots." },
      { status: 500 }
    );
  }
}

// Assign a pack to a display slot
export async function POST(req: Request) {
  try {
    const { slotId, packId } = await req.json();

    if (!slotId || !packId) {
      return NextResponse.json(
        { error: "slotId and packId are required." },
        { status: 400 }
      );
    }

    // Prevent assigning an already active pack
    const existingSlot = await prisma.displaySlot.findFirst({
      where: {
        packId,
      },
    });

    if (existingSlot) {
      return NextResponse.json(
        { error: "Pack is already assigned to another display slot." },
        { status: 400 }
      );
    }

    // Update the slot
    await prisma.displaySlot.update({
      where: {
        id: slotId,
      },
      data: {
        packId,
      },
    });

    // Activate the pack
    await prisma.pack.update({
      where: {
        id: packId,
      },
      data: {
        status: "ACTIVE",
        activatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Unable to assign pack." },
      { status: 500 }
    );
  }
}