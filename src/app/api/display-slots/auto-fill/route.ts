// app/api/display-slots/auto-fill/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { slotId } = await req.json();

    const slot = await prisma.displaySlot.findUnique({
      where: {
        id: slotId,
      },
      include: {
        pack: {
          include: {
            game: true,
          },
        },
      },
    });

    if (!slot) {
      return NextResponse.json(
        { error: "Display slot not found." },
        { status: 404 }
      );
    }

    // Slot already occupied
    if (slot.packId) {
      return NextResponse.json(
        { error: "Slot already contains a pack." },
        { status: 400 }
      );
    }

    // Find oldest back stock pack
    const nextPack = await prisma.pack.findFirst({
      where: {
        storeId: slot.storeId,
        status: "BACK_STOCK",
      },
      orderBy: {
        receivedAt: "asc",
      },
      include: {
        game: true,
      },
    });

    if (!nextPack) {
      return NextResponse.json(
        { error: "No packs available in Back Stock." },
        { status: 404 }
      );
    }

    await prisma.$transaction([
      prisma.pack.update({
        where: {
          id: nextPack.id,
        },
        data: {
          status: "ACTIVE",
          activatedAt: new Date(),
          currentTicketNumber:
            nextPack.firstTicket ?? 0,
        },
      }),

      prisma.displaySlot.update({
        where: {
          id: slot.id,
        },
        data: {
          packId: nextPack.id,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      pack: nextPack,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error: "Unable to fill display slot.",
      },
      {
        status: 500,
      }
    );
  }
}