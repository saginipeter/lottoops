import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getApiSession } from "@/lib/api-session";
import { canReceiveShipments } from "@/lib/permissions";
import { resolveReceivingPackIdentity } from "@/lib/barcode";
import type { PackWithGame } from "@/lib/types";

const MAX_BATCH_PACKS = 250;

interface BatchPackInput {
  barcode?: unknown;
  gameNumber?: unknown;
  packNumber?: unknown;
  firstTicket?: unknown;
  ticketPrice?: unknown;
  ticketQuantity?: unknown;
  packImage?: unknown;
}

interface NormalizedPackInput {
  barcode: string;
  gameNumber: string;
  packNumber: string;
  firstTicket: number;
  ticketPrice: number;
  ticketQuantity: number;
  packImage: string | null;
}

class BatchReceivingError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function normalizePack(input: BatchPackInput, index: number): NormalizedPackInput {
  const identity = resolveReceivingPackIdentity({
    barcode: input.barcode,
    gameNumber: input.gameNumber,
    packNumber: input.packNumber,
  });
  if (!identity.identity) {
    throw new BatchReceivingError(`Pack ${index + 1}: ${identity.error}`, 400);
  }

  const ticketPrice = Number(input.ticketPrice);
  const ticketQuantity = Number(input.ticketQuantity);
  const firstTicket = Number(input.firstTicket);
  if (!Number.isFinite(ticketPrice) || ticketPrice <= 0) {
    throw new BatchReceivingError(`Pack ${index + 1}: Ticket price must be greater than zero.`, 400);
  }
  if (!Number.isInteger(ticketQuantity) || ticketQuantity <= 0) {
    throw new BatchReceivingError(`Pack ${index + 1}: Ticket quantity must be a whole number greater than zero.`, 400);
  }
  if (!Number.isInteger(firstTicket) || firstTicket < 1 || firstTicket > ticketQuantity) {
    throw new BatchReceivingError(`Pack ${index + 1}: First ticket must be between 1 and ${ticketQuantity}.`, 400);
  }
  if (input.packImage != null && (typeof input.packImage !== "string" || input.packImage.length > 2048)) {
    throw new BatchReceivingError(`Pack ${index + 1}: Pack image is invalid.`, 400);
  }

  return {
    ...identity.identity,
    firstTicket,
    ticketPrice,
    ticketQuantity,
    packImage: typeof input.packImage === "string" && input.packImage.trim() ? input.packImage.trim() : null,
  };
}

export async function POST(req: NextRequest) {
  try {
    const session = await getApiSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canReceiveShipments(session)) {
      return NextResponse.json({ error: "You do not have permission to receive packs." }, { status: 403 });
    }
    if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
    const db = prisma as PrismaClient;
    if (!session.storeId || !session.userId) {
      return NextResponse.json({ error: "A valid store and user session are required." }, { status: 400 });
    }

    const rawBody: unknown = await req.json().catch(() => null);
    if (!rawBody || typeof rawBody !== "object" || Array.isArray(rawBody)) {
      return NextResponse.json({ error: "Request body must be a valid JSON object." }, { status: 400 });
    }
    const body = rawBody as { shipmentId?: unknown; packs?: unknown };
    if (typeof body.shipmentId !== "string" || !body.shipmentId.trim()) {
      return NextResponse.json({ error: "Shipment ID is required." }, { status: 400 });
    }
    if (!Array.isArray(body.packs) || body.packs.length === 0 || body.packs.length > MAX_BATCH_PACKS) {
      return NextResponse.json({ error: `Select between 1 and ${MAX_BATCH_PACKS} packs to add.` }, { status: 400 });
    }

    let packs: NormalizedPackInput[];
    try {
      packs = body.packs.map((pack, index) => {
        if (!pack || typeof pack !== "object" || Array.isArray(pack)) {
          throw new BatchReceivingError(`Pack ${index + 1}: Pack details are invalid.`, 400);
        }
        return normalizePack(pack as BatchPackInput, index);
      });
    } catch (error) {
      if (error instanceof BatchReceivingError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      throw error;
    }

    const serialNumbers = packs.map((pack) => pack.barcode);
    if (new Set(serialNumbers).size !== serialNumbers.length) {
      return NextResponse.json({ error: "The selected list contains duplicate pack barcodes. Remove duplicate rows and try again." }, { status: 409 });
    }

    const gameNumbers = [...new Set(packs.map((pack) => pack.gameNumber))];
    const existingGames = await db.game.findMany({
      where: { storeId: session.storeId, gameNumber: { in: gameNumbers } },
    });
    const existingGameNumbers = new Set(existingGames.map((game) => game.gameNumber));
    const missingGameNumbers = gameNumbers.filter((gameNumber) => !existingGameNumbers.has(gameNumber));
    const catalogByGame = new Map<string, { name: string; price: number | null }>();
    if (missingGameNumbers.length > 0) {
      try {
        const catalogRows = await db.$queryRawUnsafe<Array<{
          name: string | null;
          game_number: string;
          ticket_price: number | null;
        }>>(
          `SELECT name, game_number, ticket_price
           FROM game_catalog
           WHERE store_id = $1 AND game_number = ANY($2::text[]) AND game_type = 'scratch_off'`,
          session.storeId,
          missingGameNumbers,
        );
        for (const row of catalogRows) {
          catalogByGame.set(row.game_number, { name: row.name ?? `Game ${row.game_number}`, price: row.ticket_price });
        }
      } catch {
        // game_catalog is optional; pack-specific price and a readable fallback name are sufficient.
      }
    }

    const savedPacks = await db.$transaction(async (tx: Prisma.TransactionClient) => {
      const lockedShipments = await tx.$queryRawUnsafe<Array<{ id: string; expectedPacks: number }>>(
        `SELECT id, "expectedPacks" AS "expectedPacks"
         FROM shipments
         WHERE id = $1 AND "storeId" = $2 AND status = 'IN_PROGRESS'
         FOR UPDATE`,
        body.shipmentId,
        session.storeId,
      );
      const shipment = lockedShipments[0];
      if (!shipment) throw new BatchReceivingError("Shipment not found, already received, or access denied.", 404);

      const currentPackCount = await tx.pack.count({
        where: { storeId: session.storeId, shipmentId: shipment.id },
      });
      if (currentPackCount + packs.length > shipment.expectedPacks) {
        throw new BatchReceivingError(
          `Adding ${packs.length} selected packs would exceed the shipment's expected count (${shipment.expectedPacks}).`,
          409,
        );
      }

      const existingPacks = await tx.pack.findMany({
        where: { storeId: session.storeId, serialNumber: { in: serialNumbers } },
        select: { serialNumber: true, shipmentId: true },
      });
      if (existingPacks.length > 0) {
        const inCurrentShipment = existingPacks.some((pack) => pack.shipmentId === shipment.id);
        throw new BatchReceivingError(
          inCurrentShipment
            ? "One or more selected packs are already in this shipment. Remove duplicates and try again."
            : "One or more selected packs already exist on another shipment or were previously scanned for this store.",
          409,
        );
      }

      const gamesByNumber = new Map(existingGames.map((game) => [game.gameNumber, game]));
      const created: PackWithGame[] = [];
      for (const pack of packs) {
        let game = gamesByNumber.get(pack.gameNumber);
        if (!game) {
          const catalogEntry = catalogByGame.get(pack.gameNumber);
          game = await tx.game.create({
            data: {
              storeId: session.storeId,
              gameNumber: pack.gameNumber,
              name: catalogEntry?.name ?? `Game ${pack.gameNumber}`,
              price: catalogEntry?.price ?? pack.ticketPrice,
              ticketsPerPack: pack.ticketQuantity,
              active: true,
            },
          });
          gamesByNumber.set(pack.gameNumber, game);
        }

        created.push(await tx.pack.create({
          data: {
            shipmentId: shipment.id,
            storeId: session.storeId,
            gameId: game.id,
            receivedById: session.userId,
            serialNumber: pack.barcode,
            gameNumber: pack.gameNumber,
            packNumber: pack.packNumber,
            firstTicket: pack.firstTicket,
            ticketPrice: pack.ticketPrice,
            ticketQuantity: pack.ticketQuantity,
            packImage: pack.packImage,
            status: "RECEIVING",
            cost: pack.ticketPrice * pack.ticketQuantity * 0.95,
            retailValue: pack.ticketPrice * pack.ticketQuantity,
          },
          include: { game: true },
        }));
      }
      return created;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return NextResponse.json({ success: true, packs: savedPacks }, { status: 201 });
  } catch (error) {
    if (error instanceof BatchReceivingError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      return NextResponse.json({ error: "Shipment contents changed during receiving. Refresh the shipment before trying again." }, { status: 409 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "One or more selected packs were already added. Refresh the shipment and remove duplicates before retrying." }, { status: 409 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.json({ error: "Packs could not be saved because the shipment, game, or receiving user is no longer valid. Refresh and try again." }, { status: 409 });
    }

    console.error("[POST /api/packs/batch] Failed to save selected packs:", error);
    return NextResponse.json({ error: "Failed to add selected packs to the shipment." }, { status: 500 });
  }
}
