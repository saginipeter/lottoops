import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiSession } from "@/lib/api-session";

export async function POST(req: NextRequest) {
  const session = await getApiSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (session.role === "EMPLOYEE") {
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

  try {
    const { slotId, packId } = await req.json();

    if (!packId) {
      return NextResponse.json(
        { error: "Missing packId" },
        { status: 400 }
      );
    }

    const pack = await prisma.pack.findFirst({
      where: { id: packId, storeId: session.storeId },
    });

    if (!pack) {
      return NextResponse.json(
        { error: "Pack not found" },
        { status: 404 }
      );
    }

    if (pack.status !== "BACK_STOCK") {
      return NextResponse.json(
        { error: "Only back stock packs can be activated" },
        { status: 409 }
      );
    }

    if (!slotId) {
      return NextResponse.json(
        { error: "Display ID is required before activation." },
        { status: 400 }
      );
    }

    const slot = await prisma.displaySlot.findFirst({
      where: { id: slotId, storeId: session.storeId },
    });

    if (!slot) {
      return NextResponse.json({ error: "Display not found" }, { status: 404 });
    }

    if (slot.packId) {
      return NextResponse.json(
        { error: "Display already occupied" },
        { status: 409 }
      );
    }

    await prisma.$transaction([
      prisma.pack.update({
        where: { id: pack.id },
        data: {
          status: "ACTIVE",
          activatedAt: new Date(),
          currentTicketNumber: pack.firstTicket ?? 0,
        },
      }),
      prisma.displaySlot.update({
        where: { id: slot.id },
        data: {
          packId: pack.id,
        },
      }),
      prisma.scanLogEntry.create({
        data: {
          storeId: session.storeId,
          action: "ACTIVATED",
          packId: pack.id,
          performedById: session.userId,
          detail: `Activated pack to display ${slot.slotNumber}`,
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