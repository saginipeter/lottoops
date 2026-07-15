import { NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/games/catalog
 * Returns games from the Texas Lottery reference catalog (game_catalog table).
 * Also cross-references which ones are already added to this store's prisma.game.
 *
 * POST /api/games/catalog/[externalKey] → handled via body { action: "add", externalKey }
 * Add a catalog game to the store's prisma.game table.
 */

export async function GET(req: NextRequest) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const search = req.nextUrl.searchParams.get("search")?.toLowerCase().trim() ?? "";
  const typeFilter = req.nextUrl.searchParams.get("type") ?? "all"; // all | scratch_off | draw_game

  try {
    // Get catalog entries from raw game_catalog table
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT id, external_key, name, game_type, status, game_number, ticket_price,
              odds, top_prize, prizes_claimed, remaining_top_prizes, end_date,
              draw_days, draw_times, sales_cutoff, last_synced_at
       FROM game_catalog
       WHERE store_id = $1
       ORDER BY game_type ASC, name ASC`,
      session.storeId
    )) as {
      id: string;
      external_key: string;
      name: string;
      game_type: string;
      status: string;
      game_number: string | null;
      ticket_price: number | null;
      odds: string | null;
      top_prize: string | null;
      prizes_claimed: number | null;
      remaining_top_prizes: number | null;
      end_date: string | null;
      draw_days: unknown;
      draw_times: unknown;
      sales_cutoff: string | null;
      last_synced_at: string;
    }[];

    // Get store's already-added game numbers for cross-reference
    const storeGames = await prisma.game.findMany({
      where: { storeId: session.storeId },
      select: { gameNumber: true, id: true, active: true },
    });
    const addedGameNumbers = new Set(storeGames.map((g: { gameNumber: string | null }) => g.gameNumber));

    // Filter
    let filtered = rows;
    if (search) {
      filtered = filtered.filter(
        (r) =>
          r.name.toLowerCase().includes(search) ||
          (r.game_number ?? "").toLowerCase().includes(search)
      );
    }
    if (typeFilter !== "all") {
      filtered = filtered.filter((r) => r.game_type === typeFilter);
    }

    const catalog = filtered.map((r) => ({
      externalKey: r.external_key,
      name: r.name,
      gameType: r.game_type,
      status: r.status,
      gameNumber: r.game_number,
      ticketPrice: r.ticket_price,
      odds: r.odds,
      topPrize: r.top_prize,
      prizesClaimed: r.prizes_claimed,
      remainingTopPrizes: r.remaining_top_prizes,
      endDate: r.end_date,
      drawDays: Array.isArray(r.draw_days) ? r.draw_days : [],
      drawTimes: Array.isArray(r.draw_times) ? r.draw_times : [],
      salesCutoff: r.sales_cutoff,
      lastSyncedAt: r.last_synced_at,
      addedToStore: r.game_number ? addedGameNumbers.has(r.game_number) : false,
    }));

    return NextResponse.json({
      catalog,
      total: catalog.length,
      lastSyncedAt: catalog[0]?.lastSyncedAt ?? null,
    });
  } catch {
    // game_catalog table may not exist yet if sync was never run
    return NextResponse.json({ catalog: [], total: 0, lastSyncedAt: null });
  }
}

/**
 * POST /api/games/catalog — Add a catalog game to the store's game list
 * Body: { externalKey: string, ticketsPerPack: number }
 */
export async function POST(req: NextRequest) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (session.role === "EMPLOYEE") return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const { externalKey, ticketsPerPack = 150 } = body;

  if (!externalKey) return NextResponse.json({ error: "externalKey is required." }, { status: 400 });

  try {
    // Look up the catalog entry
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT name, game_number, ticket_price FROM game_catalog WHERE store_id = $1 AND external_key = $2 LIMIT 1`,
      session.storeId,
      externalKey
    )) as { name: string; game_number: string | null; ticket_price: number | null }[];

    if (!rows.length) return NextResponse.json({ error: "Catalog entry not found." }, { status: 404 });

    const entry = rows[0];
    if (!entry.game_number) {
      return NextResponse.json({ error: "This game has no game number and cannot be added to the store catalog." }, { status: 400 });
    }
    if (!entry.ticket_price || entry.ticket_price <= 0) {
      return NextResponse.json({ error: "This game has no ticket price. Edit manually to set it." }, { status: 400 });
    }

    // Check not already added
    const existing = await prisma.game.findFirst({
      where: { storeId: session.storeId, gameNumber: entry.game_number },
      select: { id: true },
    });
    if (existing) return NextResponse.json({ error: "This game is already in your store catalog." }, { status: 409 });

    const game = await prisma.game.create({
      data: {
        storeId: session.storeId,
        gameNumber: entry.game_number,
        name: entry.name,
        price: entry.ticket_price,
        ticketsPerPack: Number(ticketsPerPack) || 150,
        active: true,
      },
    });

    return NextResponse.json({
      success: true,
      game: { ...game, price: Number(game.price) },
    });
  } catch (err) {
    console.error("[POST /api/games/catalog]", err);
    return NextResponse.json({ error: "Failed to add game." }, { status: 500 });
  }
}
