import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/get-session";
import { canReceiveShipments } from "@/lib/permissions";
import { getSuggestedTicketQuantity } from "@/lib/ticket-quantity";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (!canReceiveShipments(session)) {
      return NextResponse.json(
        { error: "You do not have permission to receive packs." },
        { status: 403 }
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
      packImage,
      activationNumber,
      firstOrLastTicket,
    } = body;

    if (!shipmentId || typeof shipmentId !== "string") {
      return NextResponse.json({ error: "Shipment ID is required." }, { status: 400 });
    }

    const shipment = await prisma.shipment.findFirst({
      where: { id: shipmentId, storeId: session.storeId, status: "IN_PROGRESS" },
      select: { id: true, expectedPacks: true },
    });

    if (!shipment) {
      return NextResponse.json(
        { error: "Shipment not found, already received, or access denied." },
        { status: 404 }
      );
    }

    const scannedCount = await prisma.pack.count({
      where: {
        storeId: session.storeId,
        shipmentId,
      },
    });

    if (scannedCount >= shipment.expectedPacks) {
      return NextResponse.json(
        {
          error: `This shipment already reached its expected pack count (${shipment.expectedPacks}).`,
        },
        { status: 409 }
      );
    }

    if (!/^\d{7}$/.test(String(packNumber ?? ""))) {
      return NextResponse.json(
        { error: "Pack number must be exactly 7 digits." },
        { status: 400 }
      );
    }

    const normalizedTicketPrice = Number(ticketPrice);
    const requestedTicketQuantity = Number(ticketQuantity);

    if (!Number.isFinite(normalizedTicketPrice) || normalizedTicketPrice <= 0) {
      return NextResponse.json(
        { error: "Ticket price must be greater than zero." },
        { status: 400 }
      );
    }

    if (!Number.isInteger(requestedTicketQuantity) || requestedTicketQuantity <= 0) {
      return NextResponse.json(
        { error: "Ticket quantity must be a whole number greater than zero." },
        { status: 400 }
      );
    }

    const normalizedTicketQuantity = getSuggestedTicketQuantity(normalizedTicketPrice);

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

    // Find or create the game for this pack.
    // Priority: store catalog → TX sync catalog → create with provided data
    let game = await prisma.game.findFirst({
      where: { storeId: session.storeId, gameNumber },
    });

    if (!game) {
      // Try to get name/price from TX Lottery catalog
      let catalogName = `Game ${gameNumber}`;
      let catalogPrice = ticketPrice;
      let catalogQty = normalizedTicketQuantity;

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rows = (await prisma.$queryRawUnsafe(
          `SELECT name, ticket_price FROM game_catalog
           WHERE store_id = $1 AND game_number = $2 LIMIT 1`,
          session.storeId,
          gameNumber
        )) as { name: string; ticket_price: number | null }[];
        if (rows.length > 0) {
          catalogName = rows[0].name ?? catalogName;
          catalogPrice = rows[0].ticket_price ?? ticketPrice;
        }
      } catch {
        // game_catalog may not exist yet — use provided values
      }

      game = await prisma.game.create({
        data: {
          storeId: session.storeId,
          gameNumber,
          name: catalogName,
          price: catalogPrice,
          ticketsPerPack: catalogQty,
          active: true,
        },
      });
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

        ticketPrice: normalizedTicketPrice,
        ticketQuantity: normalizedTicketQuantity,
        
        packImage,
        activationNumber,
        firstOrLastTicket,

        status: "RECEIVING",
        cost: 0,
        retailValue: normalizedTicketPrice * normalizedTicketQuantity,
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

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (!canReceiveShipments(session)) {
      return NextResponse.json(
        { error: "You do not have permission to correct received packs." },
        { status: 403 }
      );
    }

    const { packId, firstTicket, ticketPrice, ticketQuantity } = await req.json();

    if (!packId) {
      return NextResponse.json(
        { error: "Pack ID is required." },
        { status: 400 }
      );
    }

    const normalizedFirstTicket = Number(firstTicket);
    const normalizedTicketPrice = Number(ticketPrice);
    const normalizedTicketQuantity = getSuggestedTicketQuantity(normalizedTicketPrice);

    if (!Number.isInteger(normalizedFirstTicket) || normalizedFirstTicket < 0) {
      return NextResponse.json(
        { error: "First ticket must be a valid whole number." },
        { status: 400 }
      );
    }

    if (!Number.isFinite(normalizedTicketPrice) || normalizedTicketPrice <= 0) {
      return NextResponse.json(
        { error: "Ticket price must be greater than zero." },
        { status: 400 }
      );
    }

    const existingPack = await prisma.pack.findFirst({
      where: {
        id: packId,
        storeId: session.storeId,
      },
    });

    if (!existingPack) {
      return NextResponse.json(
        { error: "Pack not found." },
        { status: 404 }
      );
    }

    const updatedPack = await prisma.pack.update({
      where: { id: packId },
      data: {
        firstTicket: normalizedFirstTicket,
        ticketPrice: normalizedTicketPrice,
        ticketQuantity: normalizedTicketQuantity,
        retailValue: normalizedTicketPrice * normalizedTicketQuantity,
        currentTicketNumber:
          existingPack.status === "BACK_STOCK"
            ? normalizedFirstTicket
            : existingPack.currentTicketNumber,
      },
      include: {
        game: true,
      },
    });

    return NextResponse.json(updatedPack);
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Failed to update pack." },
      { status: 500 }
    );
  }
}