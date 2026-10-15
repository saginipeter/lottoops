import { NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-session";
import { getAuditPhysicalTicket } from "@/lib/ticket-quantity";
import { calculatePhysicalAuditInventory, calculatePhysicalAuditVariance } from "@/lib/core-validation";
import { prisma } from "@/lib/prisma";
import { readShiftCashRecord, SHIFT_REPORT_CASH_QUERY } from "@/lib/shift-report-cash";
import { shiftReportWhere } from "@/lib/shift-report-query";

const INVENTORY_COST_RATE = 0.95;
const roundCurrency = (amount: number) => Math.round((amount + Number.EPSILON) * 100) / 100;
interface GamePerformance {
  id: string; gameNumber: string; name: string;
  totalTickets: number; tickets: number; activeStock: number | null;
  sales: number; cost: number;
}
type Numeric = number | string | { toString(): string };
interface ReportShiftRecord {
  id: string; openedAt: Date; closedAt: Date | null;
  openedBy: { name: string }; closedBy: { name: string } | null;
  lines: Array<{
    packId: string; slotNumber: string; beginningTicket: number;
    endingTicket: number | null; ticketsSold: number | null; salesAmount: Numeric | null;
    pack: {
      serialNumber: string; firstTicket: number | null; ticketQuantity: number | null;
      firstOrLastTicket: string | null;
      game: { id: string; gameNumber: string; name: string; price: Numeric; ticketsPerPack: number };
    };
  }>;
  inventoryAudit: {
    begunBy: { name: string }; endedBy: { name: string } | null;
    begunAt: Date; endedAt: Date | null;
    lines: Array<{
      packId: string; slotNumber: string; expectedTicket: number;
      endingExpectedTicket: number | null; beginningPhysicalTicket: number | null;
      endingPhysicalTicket: number | null; pack: { serialNumber: string };
    }>;
  } | null;
}

// GET /api/reports/shifts?from=YYYY-MM-DD&to=YYYY-MM-DD&limit=50 or ?shiftId=...
// Returns shift-level P&L: gross sales, cost, net margin, tickets sold
export async function GET(req: NextRequest) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const shiftId = searchParams.get("shiftId");
  if (shiftId !== null && !shiftId.trim()) {
    return NextResponse.json({ error: "Shift ID is required." }, { status: 400 });
  }
  const requestedLimit = Number(searchParams.get("limit") ?? "100");
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.floor(requestedLimit), 1), 500) : 100;

  // Default: last 30 days
  const toDate = !shiftId && toParam ? new Date(toParam + "T23:59:59") : new Date();
  const fromDate = !shiftId && fromParam
    ? new Date(fromParam + "T00:00:00")
    : new Date(toDate.getTime() - 30 * 24 * 60 * 60 * 1000);
  if (!Number.isFinite(fromDate.getTime()) || !Number.isFinite(toDate.getTime()) || fromDate > toDate) {
    return NextResponse.json({ error: "Invalid report date range." }, { status: 400 });
  }

  const shifts = await prisma.shift.findMany({
    where: shiftReportWhere(session.storeId, shiftId, fromDate, toDate),
    include: {
      openedBy: { select: { name: true } },
      closedBy: { select: { name: true } },
      inventoryAudit: {
        include: {
          begunBy: { select: { name: true } },
          endedBy: { select: { name: true } },
          lines: {
            include: { pack: { select: { serialNumber: true } } },
          },
        },
      },
      lines: {
        include: {
          pack: {
            include: {
              game: {
                select: { id: true, name: true, gameNumber: true, price: true, ticketsPerPack: true },
              },
            },
          },
        },
      },
    },
    orderBy: { closedAt: "desc" },
    take: limit,
  }) as ReportShiftRecord[];

  if (shiftId && shifts.length === 0) {
    return NextResponse.json({ error: "Closed shift not found." }, { status: 404 });
  }

  const cashRows = (shifts.length ? await prisma.$queryRawUnsafe(
    SHIFT_REPORT_CASH_QUERY, session.storeId, shifts.map((shift) => shift.id),
  ) : []) as Array<{ id: string; record: Record<string, unknown> }>;
  const cashByShift = new Map(cashRows.map((row) => [row.id, row.record]));

  // Build per-shift summaries

  const shiftSummaries = shifts.map((shift) => {
    let grossSales = 0;
    let ticketsSold = 0;
    let totalTickets = 0;
    let activeStock: number | null = 0;
    const gameBreakdown = new Map<string, GamePerformance>();

    for (const line of shift.lines) {
      const sold = Number(line.ticketsSold ?? 0);
      const sales = Number(line.salesAmount ?? 0);
      grossSales += sales;
      ticketsSold += sold;
      totalTickets += line.beginningTicket;
      activeStock = activeStock === null || line.endingTicket == null ? null : activeStock + line.endingTicket;

      const gid = line.pack.game.id;
      const game = gameBreakdown.get(gid) ?? {
        id: gid, gameNumber: line.pack.game.gameNumber, name: line.pack.game.name,
        totalTickets: 0, tickets: 0, activeStock: 0, sales: 0, cost: 0,
      };
      game.totalTickets += line.beginningTicket;
      game.tickets += sold;
      game.activeStock = game.activeStock === null || line.endingTicket == null ? null : game.activeStock + line.endingTicket;
      game.sales += sales;
      gameBreakdown.set(gid, game);
    }

    grossSales = roundCurrency(grossSales);
    const cogs = roundCurrency(grossSales * INVENTORY_COST_RATE);
    const netMargin = roundCurrency(grossSales - cogs);
    const marginPct = grossSales > 0 ? (netMargin / grossSales) * 100 : 0;

    return {
      id: shift.id,
      storeName: session.storeName,
      ...readShiftCashRecord(cashByShift.get(shift.id)),
      openedAt: shift.openedAt,
      closedAt: shift.closedAt,
      openedBy: shift.openedBy.name,
      closedBy: shift.closedBy?.name ?? null,
      grossSales: Math.round(grossSales * 100) / 100,
      cogs: Math.round(cogs * 100) / 100,
      netMargin: Math.round(netMargin * 100) / 100,
      marginPct: Math.round(marginPct * 10) / 10,
      ticketsSold,
      totalTickets,
      activeStock,
      gameBreakdown: Array.from(gameBreakdown.values())
        .map((game) => ({
          ...game,
          sales: roundCurrency(game.sales),
          cost: roundCurrency(game.sales * INVENTORY_COST_RATE),
        }))
        .sort((a, b) => b.sales - a.sales),
      packSales: shift.lines.map((line) => ({
        pack: line.pack.serialNumber,
        game: line.pack.game.name,
        display: line.slotNumber,
        beginning: line.beginningTicket,
        ending: line.endingTicket,
        tickets: line.ticketsSold,
        sales: line.salesAmount == null ? null : Number(line.salesAmount),
      })),
      auditOpenedBy: shift.inventoryAudit?.begunBy.name ?? null,
      auditClosedBy: shift.inventoryAudit?.endedBy?.name ?? null,
      auditOpenedAt: shift.inventoryAudit?.begunAt ?? null,
      auditClosedAt: shift.inventoryAudit?.endedAt ?? null,
      audit: shift.inventoryAudit?.lines.map((line) => {
        const shiftLine = shift.lines.find((item) => item.packId === line.packId);
        const systemExpected = line.endingExpectedTicket ?? (shiftLine?.endingTicket != null
          ? getAuditPhysicalTicket({
              currentTicketNumber: shiftLine.endingTicket,
              firstTicket: shiftLine.pack.firstTicket,
              ticketQuantity: shiftLine.pack.ticketQuantity ?? shiftLine.pack.game.ticketsPerPack,
              firstOrLastTicket: shiftLine.pack.firstOrLastTicket,
            })
          : null);
        const observed = line.endingPhysicalTicket;
        const expectedRemaining = shiftLine == null ? null
          : Math.max(shiftLine.beginningTicket - Number(shiftLine.ticketsSold ?? 0), 0);
        const inventory = shiftLine && expectedRemaining != null && observed != null
          ? calculatePhysicalAuditInventory(
              shiftLine.pack.firstTicket ?? 1,
              shiftLine.pack.ticketQuantity ?? shiftLine.pack.game.ticketsPerPack,
              expectedRemaining, observed, shiftLine.pack.firstOrLastTicket,
            )
          : null;
        return {
          pack: line.pack?.serialNumber ?? line.packId,
          display: line.slotNumber,
          direction: shiftLine?.pack.firstOrLastTicket === "LAST" ? "LAST" : "FIRST",
          beginningExpected: line.expectedTicket,
          beginning: line.beginningPhysicalTicket,
          expected: systemExpected,
          ending: observed,
          beginningTickets: shiftLine?.beginningTicket ?? null,
          salesTickets: shiftLine?.ticketsSold ?? null,
          expectedEndingTickets: expectedRemaining,
          endingTickets: inventory?.remaining ?? null,
          variance: observed == null || systemExpected == null
            ? null
            : calculatePhysicalAuditVariance(Number(systemExpected), Number(observed)),
        };
      }) ?? [],
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
  const allGamesMap = new Map<string, GamePerformance>();
  for (const s of shiftSummaries) {
    for (const g of s.gameBreakdown) {
      const existing = allGamesMap.get(g.id) ?? {
        id: g.id, gameNumber: g.gameNumber, name: g.name,
        totalTickets: 0, tickets: 0, activeStock: 0, sales: 0, cost: 0,
      };
      existing.totalTickets += g.totalTickets;
      existing.tickets += g.tickets;
      existing.activeStock = existing.activeStock === null || g.activeStock === null ? null : existing.activeStock + g.activeStock;
      existing.sales += g.sales;
      allGamesMap.set(g.id, existing);
    }
  }
  const gamePerformance = Array.from(allGamesMap.values())
    .map((g) => {
      const sales = roundCurrency(g.sales);
      const cost = roundCurrency(sales * INVENTORY_COST_RATE);
      const netMargin = roundCurrency(sales - cost);
      return {
        ...g, sales, cost, netMargin,
        marginPct: sales > 0 ? Math.round((netMargin / sales) * 1000) / 10 : 0,
      };
    })
    .sort((a, b) => b.sales - a.sales);

  const totalGross = shiftSummaries.reduce((s: number, r) => s + r.grossSales, 0);
  const totalCogs = roundCurrency(totalGross * INVENTORY_COST_RATE);
  const totalTickets = shiftSummaries.reduce((s: number, r) => s + r.ticketsSold, 0);
  // A pack can appear in multiple shifts; these are shift-scoped sums, not live inventory.
  const totalOpeningTickets = shiftSummaries.reduce((sum, shift) => sum + shift.totalTickets, 0);
  const activeStock = shiftSummaries.reduce<number | null>((sum, shift) =>
    sum === null || shift.activeStock === null ? null : sum + shift.activeStock, 0);

  return NextResponse.json({
    fromDate: fromDate.toISOString(),
    toDate: toDate.toISOString(),
    summary: {
      totalGross: Math.round(totalGross * 100) / 100,
      totalCogs: Math.round(totalCogs * 100) / 100,
      totalNet: Math.round((totalGross - totalCogs) * 100) / 100,
      totalTickets,
      totalOpeningTickets,
      activeStock,
      stockScope: "SHIFT_TOTALS",
      avgMarginPct: totalGross > 0 ? Math.round(((totalGross - totalCogs) / totalGross) * 1000) / 10 : 0,
      shiftCount: shiftSummaries.length,
    },
    shifts: shiftSummaries,
    dailyTotals,
    gamePerformance,
  });
}
