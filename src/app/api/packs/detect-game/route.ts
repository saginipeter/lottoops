import { NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/packs/detect-game?gameNumber=XXXX
 *
 * Auto-detect game info for a scanned pack:
 * 1. Check prisma.game (store's own catalog) first
 * 2. Fall back to game_catalog (Texas Lottery sync reference)
 *
 * Returns:
 *   { found: true, source: "store"|"catalog", name, price, ticketsPerPack, gameNumber }
 *   { found: false }
 */
export async function GET(req: NextRequest) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const gameNumber = req.nextUrl.searchParams.get("gameNumber")?.trim();
  if (!gameNumber) return NextResponse.json({ error: "gameNumber is required" }, { status: 400 });

  try {
    // 1. Check store's own game catalog first (most authoritative)
    const storeGame = await prisma.game.findFirst({
      where: { storeId: session.storeId, gameNumber },
    });

    if (storeGame) {
      return NextResponse.json({
        found: true,
        source: "store",
        gameNumber: storeGame.gameNumber,
        name: storeGame.name,
        price: Number(storeGame.price),
        ticketsPerPack: storeGame.ticketsPerPack,
      });
    }

    // 2. Fall back to Texas Lottery synced catalog
    try {

      const rows = (await prisma.$queryRawUnsafe(
        `SELECT name, game_number, ticket_price
         FROM game_catalog
         WHERE store_id = $1 AND game_number = $2 AND game_type = 'scratch_off'
         LIMIT 1`,
        session.storeId,
        gameNumber
      )) as { name: string; game_number: string; ticket_price: number | null }[];

      if (rows.length > 0 && rows[0].ticket_price) {
        const row = rows[0];
        // Derive tickets per pack from standard Texas Lottery table
        const ticketsPerPack = deriveTicketsPerPack(row.ticket_price ?? 0);
        return NextResponse.json({
          found: true,
          source: "catalog",
          gameNumber: row.game_number,
          name: row.name,
          price: row.ticket_price,
          ticketsPerPack,
        });
      }
    } catch {
      // game_catalog doesn't exist yet — that's fine, fall through
    }

    // 3. Not found anywhere
    return NextResponse.json({ found: false, gameNumber });
  } catch (err) {
    console.error("[GET /api/packs/detect-game]", err);
    return NextResponse.json({ error: "Detection failed" }, { status: 500 });
  }
}

/**
 * Standard Texas Lottery tickets-per-pack by ticket price.
 * Source: Texas Lottery retailer guidelines.
 */
function deriveTicketsPerPack(price: number): number {
  const map: Record<number, number> = {
    1:   300,
    2:   150,
    3:   100,
    5:    75,
    10:   50,
    20:   30,
    25:   30,
    30:   25,
    50:   20,
    100:  15,
  };
  return map[price] ?? 50;
}
