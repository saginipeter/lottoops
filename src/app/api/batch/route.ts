import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiSession } from "@/lib/api-session";

interface BatchRequestBody {
  gameId: string;
  costPerPack: number;
  serialNumbers: string[];
}

export async function POST(req: NextRequest) {
  const session = await getApiSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Viewers are read-only â€” receiving inventory is a write action.
  if (session.role === "EMPLOYEE") {
    return NextResponse.json(
      { error: "You don't have permission to receive inventory" },
      { status: 403 }
    );
  }

  if (!prisma) {
    return NextResponse.json(
      { error: "Database not connected" },
      { status: 503 }
    );
  }

  let body: BatchRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { gameId, costPerPack, serialNumbers } = body;

  if (!gameId || typeof costPerPack !== "number" || costPerPack <= 0) {
    return NextResponse.json(
      { error: "gameId and a positive costPerPack are required" },
      { status: 400 }
    );
  }

  if (!Array.isArray(serialNumbers) || serialNumbers.length === 0) {
    return NextResponse.json(
      { error: "At least one serial number is required" },
      { status: 400 }
    );
  }

  // Reject a batch with internal duplicates before touching the database â€”
  // catches a scanner double-fire or a manual typo repeated twice.
  const uniqueSerials = new Set(serialNumbers);
  if (uniqueSerials.size !== serialNumbers.length) {
    return NextResponse.json(
      { error: "Batch contains duplicate serial numbers" },
      { status: 400 }
    );
  }

  try {
    const game = await prisma.game.findFirst({
      where: { id: gameId, storeId: session.storeId },
    });

    if (!game) {
      return NextResponse.json(
        { error: "Game not found for this store" },
        { status: 404 }
      );
    }

    if (!game.active) {
      return NextResponse.json(
        { error: `${game.name} is deactivated and cannot receive new inventory` },
        { status: 409 }
      );
    }

    // Check for serials that already exist in this store's data â€” this is
    // a defense-in-depth check ahead of the DB unique constraint, so we can
    // return a clear list of which serials collided rather than a generic
    // constraint-violation error from a failed transaction.
    const existing = await prisma.pack.findMany({
      where: {
        storeId: session.storeId,
        serialNumber: { in: Array.from(uniqueSerials) },
      },
      select: { serialNumber: true },
    });

    if (existing.length > 0) {
      return NextResponse.json(
        {
          error: "Some serial numbers are already in the system",

          duplicates: existing.map((p: any) => p.serialNumber),
        },
        { status: 409 }
      );
    }

    const retailValue = Number(game.price) * game.ticketsPerPack;

    // Single transaction: every pack and its scan log entry are created
    // together, or none are. A batch of 40 scanned packs shouldn't end up
    // half-saved if something fails partway through.
    const createdPacks = await prisma.$transaction(
      Array.from(uniqueSerials).map((serialNumber) =>
        prisma.pack.create({
          data: {
            storeId: session.storeId,
            gameId: game.id,
            serialNumber,
            cost: costPerPack,
            retailValue,
            receivedById: session.userId,
            scanLogs: {
              create: {
                storeId: session.storeId,
                action: "RECEIVED",
                performedById: session.userId,
                detail: `Received into back stock â€” ${game.name}`,
              },
            },
          },
        })
      )
    );

    return NextResponse.json({
      ok: true,
      count: createdPacks.length,

      packs: createdPacks.map((p: any) => ({
        id: p.id,
        serialNumber: p.serialNumber,
      })),
    });
  } catch (err) {
    console.error("[POST /api/packs/batch]", err);
    return NextResponse.json(
      { error: "Failed to save batch. Please try again." },
      { status: 500 }
    );
  }
}