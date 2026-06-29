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

    const body = await req.json();

    const {
      shipmentId,
      barcode,
      gameNumber,
      packNumber,
      firstTicket,
      ticketPrice,
      ticketQuantity,
    } = body;

    // Prevent duplicate scans
    const existing = await prisma.pack.findUnique({
      where: {
        storeId_serialNumber: {
          storeId: session.storeId,
          serialNumber: barcode,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "This pack has already been scanned." },
        { status: 409 }
      );
    }

    // Find the game
    const game = await prisma.game.findFirst({
      where: {
        storeId: session.storeId,
        gameNumber,
      },
    });

    if (!game) {
      return NextResponse.json(
        {
          error:
            "Game not found. Please create the game before receiving packs.",
        },
        { status: 404 }
      );
    }

    const pack = await prisma.pack.create({
      data: {
        shipmentId,
        storeId: session.storeId,
        gameId: game.id,
        receivedById: session.userId,

        serialNumber: barcode,

        gameNumber,
        packNumber,
        firstTicket,

        ticketPrice,
        ticketQuantity,

        cost: 0,
        retailValue: 0,
      },
    });

    const savedPack = await prisma.pack.findUnique({
  where: {
    id: pack.id,
  },
  include: {
    game: true,
  },
});

return NextResponse.json(savedPack);

    
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Failed to save pack." },
      { status: 500 }
    );
  }
}