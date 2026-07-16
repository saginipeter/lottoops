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
      packImage,
      lotNumber,
      activationNumber,
      firstOrLastTicket,
    } = body;

    if (!/^\d{7}$/.test(String(packNumber ?? ""))) {
      return NextResponse.json(
        { error: "Pack number must be exactly 7 digits." },
        { status: 400 }
      );
    }

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
      let catalogQty = ticketQuantity;

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

        ticketPrice,
        ticketQuantity,
        
        packImage,
        lotNumber,
        activationNumber,
        firstOrLastTicket,

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