import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiSession } from "@/lib/api-session";

interface ActivateRequestBody {
  slotNumber: string;
  packId: string;
  startingTicketNumber: number;
}

export async function POST(req: NextRequest) {
  const session = await getApiSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (session.role === "VIEWER") {
    return NextResponse.json(
      { error: "You don't have permission to activate packs" },
      { status: 403 }
    );
  }

  if (!prisma) {
    return NextResponse.json(
      { error: "Database not connected" },
      { status: 503 }
    );
  }

  const body: ActivateRequestBody = await req.json();
  const { slotNumber, packId, startingTicketNumber } = body;

  if (!slotNumber || !packId || typeof startingTicketNumber !== "number") {
    return NextResponse.json(
      { error: "slotNumber, packId, and startingTicketNumber are required" },
      { status: 400 }
    );
  }

  try {
    const pack = await prisma.pack.findFirst({
      where: { id: packId, storeId: session.storeId },
      include: { game: true },
    });

    if (!pack) {
      return NextResponse.json({ error: "Pack not found" }, { status: 404 });
    }

    if (pack.status !== "BACK_STOCK") {
      return NextResponse.json(
        { error: "Only back stock packs can be activated" },
        { status: 409 }
      );
    }

    if (startingTicketNumber < 0 || startingTicketNumber >= pack.game.ticketsPerPack) {
      return NextResponse.json(
        { error: `Starting ticket must be between 0 and ${pack.game.ticketsPerPack - 1}` },
        { status: 400 }
      );
    }

    const slot = await prisma.displaySlot.findFirst({
      where: { storeId: session.storeId, slotNumber },
    });

    if (!slot) {
      return NextResponse.json({ error: "Slot not found" }, { status: 404 });
    }

    if (slot.packId) {
      const existingPack = await prisma.pack.findUnique({
        where: { id: slot.packId },
      });
      if (existingPack && existingPack.status === "ACTIVE") {
        return NextResponse.json(
          { error: "This slot already has an active pack — close it out first" },
          { status: 409 }
        );
      }
    }

    // One transaction: activate the pack, assign it to the slot, log it.
    await prisma.$transaction([
      prisma.pack.update({
        where: { id: pack.id },
        data: {
          status: "ACTIVE",
          currentTicketNumber: startingTicketNumber,
          activatedAt: new Date(),
        },
      }),
      prisma.displaySlot.update({
        where: { id: slot.id },
        data: { packId: pack.id },
      }),
      prisma.scanLogEntry.create({
        data: {
          storeId: session.storeId,
          action: "ACTIVATED",
          packId: pack.id,
          performedById: session.userId,
          detail: `Activated to slot ${slotNumber} — ${pack.game.name}, starting at ticket ${startingTicketNumber}`,
        },
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/slots/activate]", err);
    return NextResponse.json(
      { error: "Failed to activate pack. Please try again." },
      { status: 500 }
    );
  }
}