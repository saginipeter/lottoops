import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/get-session";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const {
      packId,
      slotId,
      activationNumber,
      activationReceiptPhoto,
      lotNumber,
      firstOrLastTicket,
    } = await req.json();

    if (!packId) {
      return NextResponse.json(
        { error: "Pack ID is required." },
        { status: 400 }
      );
    }

    if (!slotId) {
      return NextResponse.json(
        { error: "Display ID is required." },
        { status: 400 }
      );
    }

    // Verify pack exists and belongs to user's store
    const pack = await prisma.pack.findUnique({
      where: { id: packId },
    });

    if (!pack || pack.storeId !== session.storeId) {
      return NextResponse.json(
        { error: "Pack not found or access denied." },
        { status: 404 }
      );
    }

    if (pack.status !== "BACK_STOCK") {
      return NextResponse.json(
        { error: "Only packs in BACK_STOCK can be activated." },
        { status: 400 }
      );
    }

    // Verify slot is available
    const slot = await prisma.displaySlot.findUnique({
      where: { id: slotId },
    });

    if (!slot || slot.storeId !== session.storeId) {
      return NextResponse.json(
        { error: "Display not found or access denied." },
        { status: 404 }
      );
    }

    if (slot.packId && slot.packId !== packId) {
      return NextResponse.json(
        { error: "Display is already occupied." },
        { status: 400 }
      );
    }

    // Update pack with activation details
    const updatedPack = await prisma.pack.update({
      where: { id: packId },
      data: {
        status: "ACTIVE",
        activatedAt: new Date(),
        activationNumber: activationNumber || undefined,
        activationReceiptPhoto: activationReceiptPhoto || undefined,
        lotNumber: lotNumber || undefined,
        firstOrLastTicket: firstOrLastTicket || undefined,
      },
    });

    // Assign pack to slot
    await prisma.displaySlot.update({
      where: { id: slotId },
      data: { packId },
    });

    return NextResponse.json({
      success: true,
      pack: updatedPack,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Unable to activate pack." },
      { status: 500 }
    );
  }
}