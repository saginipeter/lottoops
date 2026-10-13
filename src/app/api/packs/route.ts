import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiSession } from "@/lib/api-session";
import { canReceiveShipments } from "@/lib/permissions";
import { getSuggestedTicketQuantity } from "@/lib/ticket-quantity";
import { resolveReceivingPackIdentity } from "@/lib/barcode";
import { Prisma } from "@prisma/client";

type CreatePackBody = {
  shipmentId?: string;
  firstTicket?: number | string;
  ticketPrice?: number | string;
  ticketQuantity?: number | string;
  packImage?: string | null;
  activationNumber?: string | null;
  firstOrLastTicket?: string | null;
  barcode?: unknown;
  gameNumber?: unknown;
  packNumber?: unknown;
};

export async function POST(req: NextRequest) {
  try {
    const session = await getApiSession();

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

    const rawBody: unknown = await req.json().catch(() => null);
    if (!rawBody || typeof rawBody !== "object" || Array.isArray(rawBody)) {
      return NextResponse.json({ error: "Request body must be a valid JSON object." }, { status: 400 });
    }
    const body = rawBody as CreatePackBody;

    const {
      shipmentId,
      firstTicket,
      ticketPrice,
      ticketQuantity,
      packImage,
      activationNumber,
      firstOrLastTicket,
    } = body;

    const resolvedIdentity = resolveReceivingPackIdentity({
      barcode: body.barcode,
      gameNumber: body.gameNumber,
      packNumber: body.packNumber,
    });
    if (!resolvedIdentity.identity) {
      return NextResponse.json({ error: resolvedIdentity.error }, { status: 400 });
    }
    const { barcode, gameNumber, packNumber } = resolvedIdentity.identity;

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

    const normalizedFirstTicket = Number(firstTicket);
    if (!Number.isInteger(normalizedFirstTicket) || normalizedFirstTicket < 1 || normalizedFirstTicket > requestedTicketQuantity) {
      return NextResponse.json(
        { error: `First ticket must be between 1 and ${requestedTicketQuantity}.` },
        { status: 400 }
      );
    }

    // Preserve a valid manual quantity override; the suggested quantity is only
    // the default supplied by the receiving UI.
    const normalizedTicketQuantity = requestedTicketQuantity;

    // Prevent duplicate scans within the current shipment draft.
    const existingForShipment = await prisma.pack.findFirst({
      where: {
        storeId: session.storeId,
        shipmentId,
        serialNumber: barcode,
      },
    });

    if (existingForShipment) {
      return NextResponse.json(
        { error: "This pack is already in the current shipment." },
        { status: 409 }
      );
    }

    const existingAcrossStore = await prisma.pack.findUnique({
      where: {
        storeId_serialNumber: {
          storeId: session.storeId,
          serialNumber: barcode,
        },
      },
    });

    if (existingAcrossStore && existingAcrossStore.shipmentId !== shipmentId) {
      return NextResponse.json(
        {
          error: "This pack already exists on another shipment or was previously scanned for this store.",
        },
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
      const catalogQty = normalizedTicketQuantity;

      try {
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
        firstTicket: normalizedFirstTicket,

        ticketPrice: normalizedTicketPrice,
        ticketQuantity: normalizedTicketQuantity,
        
        packImage,
        activationNumber,
        firstOrLastTicket,

        status: "RECEIVING",
        // Expected inventory cost is the amount paid up front: 95% of face
        // value. The remaining 5% is the store's margin.
        cost: normalizedTicketPrice * normalizedTicketQuantity * 0.95,
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
    console.error("[POST /api/packs] Failed to create pack:", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "This pack was already added. Refresh the shipment pack list before scanning it again." },
        { status: 409 }
      );
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.json(
        { error: "Pack could not be saved because its shipment, game, or receiving user is no longer valid. Refresh the shipment and try again.", code: error.code },
        { status: 409 }
      );
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2021" || error.code === "P2022")) {
      return NextResponse.json(
        { error: `Pack could not be saved because the database schema is missing a required table or column (${error.code}). Apply the latest migrations.`, code: error.code },
        { status: 503 }
      );
    }

    const details = error instanceof Error ? error.message : String(error);
    const code = error instanceof Prisma.PrismaClientKnownRequestError ? error.code : "UNKNOWN";
    return NextResponse.json({ error: `Failed to save pack (${code}).`, details, code }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getApiSession();

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
    const requestedTicketQuantity = Number(ticketQuantity);
    const normalizedTicketQuantity = Number.isInteger(requestedTicketQuantity) && requestedTicketQuantity > 0
      ? requestedTicketQuantity
      : getSuggestedTicketQuantity(normalizedTicketPrice);

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

// Removes a pack that is still being received so it no longer counts toward
// the shipment's expected pack limit or blocks re-scanning the same pack.
export async function DELETE(req: NextRequest) {
  try {
    const session = await getApiSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canReceiveShipments(session)) {
      return NextResponse.json({ error: "You do not have permission to remove received packs." }, { status: 403 });
    }

    const body = (await req.json().catch(() => null)) as {
      packId?: unknown;
      shipmentId?: unknown;
      keepPackIds?: unknown;
    } | null;

    // Sync mode: remove every still-receiving pack on the shipment that is no
    // longer in the user's draft (e.g. packs deleted before clicking Review).
    if (typeof body?.shipmentId === "string" && Array.isArray(body.keepPackIds)) {
      const keepPackIds = body.keepPackIds.filter((id): id is string => typeof id === "string");
      const stale: Array<{ id: string }> = await prisma.pack.findMany({
        where: {
          storeId: session.storeId,
          shipmentId: body.shipmentId,
          status: "RECEIVING",
          shipment: { status: "IN_PROGRESS" },
          id: { notIn: keepPackIds },
        },
        select: { id: true },
      });
      const staleIds = stale.map((row) => row.id);
      if (staleIds.length > 0) {
        await prisma.$transaction([
          prisma.document.updateMany({ where: { packId: { in: staleIds } }, data: { packId: null } }),
          prisma.pack.deleteMany({ where: { id: { in: staleIds } } }),
        ]);
      }
      return NextResponse.json({ ok: true, removed: staleIds.length });
    }

    const packId = typeof body?.packId === "string" ? body.packId : "";
    if (!packId) {
      return NextResponse.json({ error: "Pack ID is required." }, { status: 400 });
    }

    const pack = await prisma.pack.findFirst({
      where: {
        id: packId,
        storeId: session.storeId,
        status: "RECEIVING",
        shipment: { status: "IN_PROGRESS" },
      },
      select: { id: true },
    });
    if (!pack) {
      return NextResponse.json({ ok: true, removed: false });
    }

    await prisma.$transaction([
      prisma.document.updateMany({ where: { packId: pack.id }, data: { packId: null } }),
      prisma.pack.delete({ where: { id: pack.id } }),
    ]);

    return NextResponse.json({ ok: true, removed: true });
  } catch (error) {
    console.error("[DELETE /api/packs] Failed to remove pack:", error);
    return NextResponse.json({ error: "Failed to remove pack." }, { status: 500 });
  }
}
