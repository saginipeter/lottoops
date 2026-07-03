// app/api/shifts/open/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    // Prevent multiple open shifts
    const existingShift = await prisma.shift.findFirst({
      where: {
        status: "OPEN",
      },
    });

    if (existingShift) {
      return NextResponse.json(
        { error: "A shift is already open." },
        { status: 400 }
      );
    }

    // TODO: Replace with logged-in user ID
    const userId = "YOUR_USER_ID";

    // TODO: Replace with current store ID
    const storeId = "YOUR_STORE_ID";

    // Get all active packs currently on display
    const displaySlots = await prisma.displaySlot.findMany({
      where: {
        packId: {
          not: null,
        },
      },
      include: {
        pack: true,
      },
    });

    const shift = await prisma.shift.create({
      data: {
        storeId,
        openedById: userId,
        status: "OPEN",

        lines: {
          create: displaySlots.map((slot: any) => ({
            packId: slot.pack!.id,
            slotNumber: slot.slotNumber,
            beginningTicket:
              slot.pack!.currentTicketNumber ??
              slot.pack!.firstTicket ??
              0,
          })),
        },
      },

      include: {
        lines: true,
      },
    });

    return NextResponse.json(shift);
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Unable to open shift." },
      { status: 500 }
    );
  }
}