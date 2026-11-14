import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Panel } from "@/components/ui/panel";
import { PageToolbar } from "@/components/ui/page-toolbar";
import { StatusBar } from "@/components/ui/status-bar";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/get-session";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { LivePageRefresh } from "@/components/layout/live-page-refresh";
import { calculateTicketSaleSplit } from "@/lib/ticket-sales";

export default async function SalesPage({ searchParams }: { searchParams?: Promise<{ shiftId?: string; terminal?: string }> }) {
  const session = await getSession();

  if (!session) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header title="Ticket Tracking" subtitle="Not authenticated" />
        <div className="flex-1 overflow-y-auto p-6">
          <div className="rounded-lg border-2 border-dashed border-red-300 bg-red-50 p-6 text-center">
            <p className="text-red-600 font-medium">Not authenticated</p>
          </div>
        </div>
      </div>
    );
  }

  if (!prisma) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header title="Ticket Tracking" subtitle="Database unavailable" />
        <div className="flex-1 overflow-y-auto p-6">
          <div className="rounded-lg border-2 border-dashed border-yellow-300 bg-yellow-50 p-6 text-center">
            <p className="text-yellow-800 font-medium">Database not connected</p>
          </div>
        </div>
      </div>
    );
  }

  const params = searchParams ? await searchParams : {};
  const shiftBoundRole = session.role === "EMPLOYEE" || session.role === "SHIFT_LEAD";
  const terminalFilter = shiftBoundRole ? session.terminalId : params.terminal?.trim().toUpperCase();
  const openShifts: Array<{ id: string; shiftNumber: number | null; terminalId: string | null }> = await prisma.shift.findMany({
    where: { storeId: session.storeId, status: "OPEN", ...(terminalFilter ? { terminalId: terminalFilter } : {}) },
    select: { id: true, shiftNumber: true, terminalId: true },
    orderBy: [{ terminalId: "asc" }, { shiftNumber: "asc" }],
  });
  const requestedShiftId = shiftBoundRole ? session.shiftId : params.shiftId;
  const selectedShiftId = requestedShiftId ?? (openShifts.length === 1 ? openShifts[0].id : null);
  const [openShift, recentClosedShifts, activePacks] = await Promise.all([
    selectedShiftId ? prisma.shift.findFirst({
      where: { id: selectedShiftId, storeId: session.storeId },
      include: {
        lines: {
          include: {
            pack: {
              include: {
                game: true,
              },
            },
          },
          orderBy: {
            slotNumber: "asc",
          },
        },
      },
    }) : Promise.resolve(null),
    shiftBoundRole ? Promise.resolve([]) : prisma.shift.findMany({
      where: {
        storeId: session.storeId,
        status: "CLOSED",
      },
      include: {
        lines: true,
      },
      orderBy: {
        closedAt: "desc",
      },
      take: 7,
    }),
    prisma.pack.count({
      where: {
        storeId: session.storeId,
        status: "ACTIVE",
      },
    }),
  ]);

  const currentLines = openShift?.lines ?? [];
  const sessionPackSales = (shiftBoundRole && session.loginSessionId && selectedShiftId
    ? await prisma.$queryRawUnsafe(`
        SELECT e.pack_id AS "packId", g.name AS "gameName", g."gameNumber" AS "gameNumber",
          p."packNumber" AS "packNumber", e.display_number AS "displayNumber",
          COUNT(*)::int AS "ticketsSold", COALESCE(SUM(e.ticket_price), 0)::numeric AS "salesAmount",
          MIN(e.scanned_at) AS "firstSaleAt", MAX(e.scanned_at) AS "lastSaleAt"
        FROM live_scan_events e
        JOIN packs p ON p.id = e.pack_id AND p."storeId" = e.store_id
        JOIN games g ON g.id = p."gameId"
        WHERE e.store_id = $1 AND e.shift_id = $2 AND e.scanned_by_id = $3 AND e.login_session_id = $4
        GROUP BY e.pack_id, g.name, g."gameNumber", p."packNumber", e.display_number
        ORDER BY e.display_number NULLS LAST, p."packNumber" ASC
      `, session.storeId, selectedShiftId, session.userId, session.loginSessionId)
    : []) as Array<{ packId: string; gameName: string; gameNumber: string; packNumber: string | null; displayNumber: string | null; ticketsSold: number; salesAmount: number | string; firstSaleAt: Date; lastSaleAt: Date }>;

  const shiftCurrentTickets = currentLines.reduce((sum: number, line: any) => {
    const fallbackSold = Math.max(
      Number(line.beginningTicket) - Number(line.endingTicket ?? line.beginningTicket),
      0
    );
    return sum + Number(line.ticketsSold ?? fallbackSold);
  }, 0);

  const shiftCurrentSales = currentLines.reduce((sum: number, line: any) => {
    const fallbackSold = Math.max(
      Number(line.beginningTicket) - Number(line.endingTicket ?? line.beginningTicket),
      0
    );
    const fallbackSales = fallbackSold * Number(line.pack.game.price);
    return sum + Number(line.salesAmount ?? fallbackSales);
  }, 0);

  const weekSales = recentClosedShifts.reduce((sum: number, shift: any) => {
    const shiftSales = shift.lines.reduce((lineSum: number, line: any) => {
      return lineSum + Number(line.salesAmount ?? 0);
    }, 0);
    return sum + shiftSales;
  }, 0);

  const currentTickets = shiftBoundRole ? sessionPackSales.reduce((sum, row) => sum + Number(row.ticketsSold), 0) : shiftCurrentTickets;
  const currentSales = shiftBoundRole ? sessionPackSales.reduce((sum, row) => sum + Number(row.salesAmount), 0) : shiftCurrentSales;
  const currentProfit = calculateTicketSaleSplit(currentSales).profitAmount;
  const weekProfit = calculateTicketSaleSplit(weekSales).profitAmount;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <LivePageRefresh intervalMs={3000} />
        <Header
        title="Ticket Tracking"
        subtitle={shiftBoundRole ? "Your tracked tickets for this sign-in only" : "Ticket tracking by terminal shift"}
      />

      <PageToolbar
        left={<span className="text-xs text-text-secondary">{openShift?.terminalId ?? session.terminalId ?? "All terminals"} · Shift {openShift?.shiftNumber ?? "—"}: {openShift?.status ?? (openShifts.length > 0 ? "Select a shift" : "Closed")}</span>}
        center={<span>Ctrl+P Print | Ctrl+F Search</span>}
        right={<span className="text-xs text-text-tertiary">Active Packs: {activePacks}</span>}
      />

      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Shift Status"
              value={openShift ? "OPEN" : "CLOSED"}
              hint={openShift ? "Ticket tracking is in progress" : "Open a shift to begin tracking tickets"}
            />
            <StatCard
              label={shiftBoundRole ? "Your Login Ticket Value" : "Current Shift Ticket Value"}
              value={formatCurrency(currentSales)}
              hint={`${currentTickets} tickets tracked${shiftBoundRole ? " in this sign-in" : " in the selected shift"}`}
            />
            <StatCard
              label="Store Share (5%)"
              value={formatCurrency(currentProfit)}
              hint={shiftBoundRole ? "Your session share (5%)" : "Current shift store share"}
            />
            <StatCard
              label="Active Packs"
              value={String(activePacks)}
              hint="Packs available on display"
            />
            {!shiftBoundRole && <StatCard
              label="Last 7 Shifts · Ticket Value"
              value={formatCurrency(weekSales)}
              hint={`${recentClosedShifts.length} closed shifts · store share ${formatCurrency(weekProfit)}`}
            />}
          </div>

          <Panel className="p-4">
            <div className="flex flex-wrap gap-2">
              {openShifts.length > 1 && !shiftBoundRole && openShifts.map((item) => <QuickLink key={item.id} href={`/sales?terminal=${encodeURIComponent(item.terminalId ?? "")}&shiftId=${encodeURIComponent(item.id)}`} label={`${item.terminalId ?? "Terminal"} · Shift ${item.shiftNumber ?? "—"}`} />)}
              {openShift?.status === "OPEN" && <QuickLink href={`/pos?terminal=${encodeURIComponent(openShift.terminalId ?? session.terminalId ?? "")}&shiftId=${encodeURIComponent(openShift.id)}`} label="Track Tickets" />}
              {!shiftBoundRole && <QuickLink href="/reports" label="Open Reports" />}
            </div>
          </Panel>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <Panel className="xl:col-span-2 p-4">
              <h3 className="text-base font-semibold text-text">{shiftBoundRole ? "Your Ticket Tracking This Sign-in" : "Current Shift Tracking by Pack"}</h3>
              {shiftBoundRole ? !session.loginSessionId ? (
                <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">This sign-in predates ticket-session tracking. Sign out and sign in again to start a separate employee tracking record.</p>
              ) : sessionPackSales.length === 0 ? (
                <p className="mt-3 text-sm text-text-secondary">No tickets have been tracked in this login session yet.</p>
              ) : (
                <SessionPackSalesTable rows={sessionPackSales} terminalId={session.terminalId ?? "—"} shiftNumber={session.shiftNumber ?? null} />
              ) : !openShift ? (
                <p className="mt-3 text-sm text-text-secondary">
                  No open shift. Open a shift to track tickets.
                </p>
              ) : currentLines.length === 0 ? (
                <p className="mt-3 text-sm text-text-secondary">
                  No shift lines found for this shift.
                </p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-tertiary">
                        <th className="py-2 pr-4">Slot</th>
                        <th className="py-2 pr-4">Game</th>
                        <th className="py-2 pr-4">Pack</th>
                        <th className="py-2 pr-4 text-right">Tickets</th>
                        <th className="py-2 pr-4 text-right">Ticket Value</th>
                        <th className="py-2 text-right">Store Share (5%)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentLines.map((line: any) => {
                        const sold = Number(
                          line.ticketsSold ??
                            Math.max(
                              Number(line.beginningTicket) -
                                Number(line.endingTicket ?? line.beginningTicket),
                              0
                            )
                        );
                        const sales = Number(
                          line.salesAmount ?? sold * Number(line.pack.game.price)
                        );
                        const profit = Number(line.profitAmount ?? calculateTicketSaleSplit(sales).profitAmount);
                        return (
                          <tr key={line.id} className="border-b border-border">
                            <td className="py-2 pr-4 text-text">{line.slotNumber}</td>
                            <td className="py-2 pr-4 text-text">{line.pack.game.name}</td>
                            <td className="py-2 pr-4 text-text-secondary">
                              #{line.pack.packNumber ?? "N/A"}
                            </td>
                            <td className="py-2 pr-4 text-right font-medium text-text">
                              {sold}
                            </td>
                            <td className="py-2 pr-4 text-right font-medium text-text">
                              {formatCurrency(sales)}
                            </td>
                            <td className="py-2 text-right font-medium text-emerald-700">
                              {formatCurrency(profit)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>

            <Panel className="p-4">
              <h3 className="text-base font-semibold text-text">{shiftBoundRole ? "Ticket Tracking Visibility" : "Recent Closed Shifts"}</h3>
              {shiftBoundRole ? (
                <p className="mt-3 text-sm text-text-secondary">This page shows only tickets tracked in your current sign-in. Store-wide and other employee reports are reserved for managers and owners.</p>
              ) : recentClosedShifts.length === 0 ? (
                <p className="mt-3 text-sm text-text-secondary">
                  No closed shifts yet.
                </p>
              ) : (
                <div className="mt-4 space-y-2">
                  {recentClosedShifts.map((shift: any) => {
                    const shiftSales = shift.lines.reduce((sum: number, line: any) => {
                      return sum + Number(line.salesAmount ?? 0);
                    }, 0);
                    const shiftTickets = shift.lines.reduce((sum: number, line: any) => {
                      return sum + Number(line.ticketsSold ?? 0);
                    }, 0);
                    return (
                      <div
                        key={shift.id}
                        className="rounded-md border border-border bg-surface-soft p-3"
                      >
                        <p className="text-xs text-text-tertiary">
                          {shift.closedAt ? formatDateTime(shift.closedAt) : "Not closed"}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-text">
                          Shift {shift.shiftNumber ?? "—"} · {formatCurrency(shiftSales)}
                        </p>
                        <p className="text-xs text-text-secondary">
                          {shiftTickets} tickets tracked · {formatCurrency(shiftSales)} ticket value
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>
          </div>
        </div>
      </div>

      <StatusBar
        left={<span>Tickets Tracked This Shift: {currentTickets}</span>}
        center={<span>{shiftBoundRole ? "Your login ticket value" : "Shift ticket value"}: {formatCurrency(currentSales)}{shiftBoundRole ? "" : ` | Week ticket value: ${formatCurrency(weekSales)}`}</span>}
        right={<span>{shiftBoundRole ? `${currentTickets} tickets · this sign-in` : `${recentClosedShifts.length} closed shifts loaded`}</span>}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Panel className="p-4">
      <p className="text-xs uppercase tracking-wide text-text-tertiary">{label}</p>
      <p className="mt-2 text-xl font-semibold text-text">{value}</p>
      <p className="mt-1 text-xs text-text-secondary">{hint}</p>
    </Panel>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-md border border-border bg-surface px-3 py-2 text-xs font-medium text-text transition-colors hover:bg-surface-soft"
    >
      {label}
    </Link>
  );
}

function SessionPackSalesTable({ rows, terminalId, shiftNumber }: {
  rows: Array<{ packId: string; gameName: string; gameNumber: string; packNumber: string | null; displayNumber: string | null; ticketsSold: number; salesAmount: number | string; firstSaleAt: Date; lastSaleAt: Date }>;
  terminalId: string;
  shiftNumber: number | null;
}) {
  return <div className="mt-4 overflow-x-auto">
    <table className="w-full min-w-[680px] text-sm">
      <thead><tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-tertiary">
        <th className="py-2 pr-4">Terminal / Shift</th><th className="py-2 pr-4">Display #</th><th className="py-2 pr-4">Game / Pack</th><th className="py-2 pr-4 text-right">Tickets Tracked</th><th className="py-2 text-right">Your Ticket Value</th>
      </tr></thead>
      <tbody>{rows.map((row) => <tr key={row.packId} className="border-b border-border">
        <td className="py-2 pr-4">{terminalId} · Shift {shiftNumber ?? "—"}</td>
        <td className="py-2 pr-4">{row.displayNumber ?? "Backstock"}</td>
        <td className="py-2 pr-4"><span className="font-medium text-text">{row.gameName}</span><span className="block text-xs text-text-secondary">Game {row.gameNumber} · Pack #{row.packNumber ?? "—"}</span></td>
        <td className="py-2 pr-4 text-right font-semibold">{Number(row.ticketsSold)}</td>
        <td className="py-2 text-right font-semibold">{formatCurrency(Number(row.salesAmount))}</td>
      </tr>)}</tbody>
    </table>
  </div>;
}
