import { NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";

// GET /api/reports/shifts?from=YYYY-MM-DD&to=YYYY-MM-DD&limit=50
// Returns shift-level P&L: gross sales, cost, net margin, tickets sold
export async function GET(req: NextRequest) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const limit = Math.min(Number(searchParams.get("limit") ?? "100"), 500);

  // Default: last 30 days
  const toDate = toParam ? new Date(toParam + "T23:59:59") : new Date();
  const fromDate = fromParam
    ? new Date(fromParam + "T00:00:00")
    : new Date(toDate.getTime() - 30 * 24 * 60 * 60 * 1000);

  const shifts = await prisma.shift.findMany({
    where: {
      storeId: session.storeId,
      status: "CLOSED",
      closedAt: { gte: fromDate, lte: toDate },
    },
    include: {
      openedBy: { select: { name: true } },
      closedBy: { select: { name: true } },
      lines: {
        include: {
          pack: {
            include: {
              game: {
                select: { id: true, name: true, gameNumber: true, price: true },
              },
            },
          },
        },
      },
    },
    orderBy: { closedAt: "desc" },
    take: limit,
  });

  // Build per-shift summaries

  const shiftSummaries = (shifts as any[]).map((shift) => {
    let grossSales = 0;
    let cogs = 0;
    let ticketsSold = 0;
    const gameBreakdown: Record<string, { name: string; tickets: number; sales: number; cost: number }> = {};

    for (const line of shift.lines) {
      const sold = Number(line.ticketsSold ?? 0);
      const sales = Number(line.salesAmount ?? 0);
      // Cost per ticket = pack cost / ticketQuantity; use game price as proxy if not set
      const ticketPrice = Number(line.pack.game.price);
      const packCost = sold * ticketPrice * 0.7; // TXLottery retailers keep ~30% margin

      grossSales += sales;
      cogs += packCost;
      ticketsSold += sold;

      const gid = line.pack.game.id;
      if (!gameBreakdown[gid]) {
        gameBreakdown[gid] = { name: line.pack.game.name, tickets: 0, sales: 0, cost: 0 };
      }
      gameBreakdown[gid].tickets += sold;
      gameBreakdown[gid].sales += sales;
      gameBreakdown[gid].cost += packCost;
    }

    const netMargin = grossSales - cogs;
    const marginPct = grossSales > 0 ? (netMargin / grossSales) * 100 : 0;

    return {
      id: shift.id,
      openedAt: shift.openedAt,
      closedAt: shift.closedAt,
      openedBy: shift.openedBy.name,
      closedBy: shift.closedBy?.name ?? "—",
      grossSales: Math.round(grossSales * 100) / 100,
      cogs: Math.round(cogs * 100) / 100,
      netMargin: Math.round(netMargin * 100) / 100,
      marginPct: Math.round(marginPct * 10) / 10,
      ticketsSold,
      gameBreakdown: Object.values(gameBreakdown).sort((a, b) => b.sales - a.sales),
    };
  });

  // Daily rollup
  const dailyMap = new Map<string, { date: string; grossSales: number; ticketsSold: number; shifts: number }>();
  for (const s of shiftSummaries) {
    const day = (s.closedAt ?? s.openedAt).toISOString().slice(0, 10);
    const existing = dailyMap.get(day) ?? { date: day, grossSales: 0, ticketsSold: 0, shifts: 0 };
    existing.grossSales += s.grossSales;
    existing.ticketsSold += s.ticketsSold;
    existing.shifts += 1;
    dailyMap.set(day, existing);
  }
  const dailyTotals = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  // Per-game totals across all shifts
  const allGamesMap = new Map<string, { name: string; tickets: number; sales: number; cost: number }>();
  for (const s of shiftSummaries) {
    for (const g of s.gameBreakdown) {
      const existing = allGamesMap.get(g.name) ?? { name: g.name, tickets: 0, sales: 0, cost: 0 };
      existing.tickets += g.tickets;
      existing.sales += g.sales;
      existing.cost += g.cost;
      allGamesMap.set(g.name, existing);
    }
  }
  const gamePerformance = Array.from(allGamesMap.values())
    .map((g) => ({
      ...g,
      sales: Math.round(g.sales * 100) / 100,
      cost: Math.round(g.cost * 100) / 100,
      netMargin: Math.round((g.sales - g.cost) * 100) / 100,
      marginPct: g.sales > 0 ? Math.round(((g.sales - g.cost) / g.sales) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.sales - a.sales);

  const totalGross = shiftSummaries.reduce((s: number, r) => s + r.grossSales, 0);
  const totalCogs = shiftSummaries.reduce((s: number, r) => s + r.cogs, 0);
  const totalTickets = shiftSummaries.reduce((s: number, r) => s + r.ticketsSold, 0);

  return NextResponse.json({
    fromDate: fromDate.toISOString(),
    toDate: toDate.toISOString(),
    summary: {
      totalGross: Math.round(totalGross * 100) / 100,
      totalCogs: Math.round(totalCogs * 100) / 100,
      totalNet: Math.round((totalGross - totalCogs) * 100) / 100,
      totalTickets,
      avgMarginPct: totalGross > 0 ? Math.round(((totalGross - totalCogs) / totalGross) * 1000) / 10 : 0,
      shiftCount: shiftSummaries.length,
    },
    shifts: shiftSummaries,
    dailyTotals,
    gamePerformance,
  });
}
