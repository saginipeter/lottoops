"use client";

import { useState, useEffect, useCallback } from "react";
import { Download, RefreshCw, TrendingUp, TrendingDown, Calendar, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";

interface GameRow { name: string; tickets: number; sales: number; cost: number; netMargin: number; marginPct: number; }
interface ShiftRow {
  id: string;
  openedAt: string;
  closedAt: string | null;
  openedBy: string;
  closedBy: string;
  grossSales: number;
  cogs: number;
  netMargin: number;
  marginPct: number;
  ticketsSold: number;
  gameBreakdown: GameRow[];
}
interface DailyRow { date: string; grossSales: number; ticketsSold: number; shifts: number; }
interface Summary {
  totalGross: number; totalCogs: number; totalNet: number; totalTickets: number;
  avgMarginPct: number; shiftCount: number;
}
interface ReportData {
  summary: Summary;
  shifts: ShiftRow[];
  dailyTotals: DailyRow[];
  gamePerformance: GameRow[];
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}
function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}
function fmtDay(d: string) {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(new Date(d + "T12:00:00"));
}

function StatCard({ label, value, sub, up }: { label: string; value: string; sub?: string; up?: boolean }) {
  return (
    <Panel className="p-4">
      <p className="text-xs uppercase tracking-wide text-text-tertiary">{label}</p>
      <p className="mt-1.5 text-2xl font-bold text-text">{value}</p>
      {sub && (
        <p className={`mt-1 flex items-center gap-1 text-xs font-medium ${up === undefined ? "text-text-secondary" : up ? "text-green-600" : "text-red-500"}`}>
          {up !== undefined && (up ? <TrendingUp size={11} /> : <TrendingDown size={11} />)}
          {sub}
        </p>
      )}
    </Panel>
  );
}

function MarginBar({ pct }: { pct: number }) {
  const color = pct >= 25 ? "bg-green-500" : pct >= 15 ? "bg-yellow-500" : "bg-red-400";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 rounded-full bg-border overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className="text-xs tabular-nums">{pct.toFixed(1)}%</span>
    </div>
  );
}

export function FinancialReports() {
  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  const [from, setFrom] = useState(thirtyDaysAgo);
  const [to, setTo] = useState(today);
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedShift, setExpandedShift] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"shifts" | "daily" | "games">("shifts");

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/shifts?from=${from}&to=${to}`);
      if (!res.ok) { setError("Failed to load report."); return; }
      setData(await res.json());
    } catch {
      setError("Network error loading report.");
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { loadReport(); }, [loadReport]);

  function downloadCSV(type: "shifts" | "games" | "inventory" | "activity") {
    window.open(`/api/reports/export?type=${type}&from=${from}&to=${to}`, "_blank");
  }

  const presets = [
    { label: "Today", days: 0 },
    { label: "7 days", days: 7 },
    { label: "30 days", days: 30 },
    { label: "90 days", days: 90 },
  ];

  function applyPreset(days: number) {
    const t = new Date().toISOString().slice(0, 10);
    const f = days === 0
      ? t
      : new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    setFrom(f);
    setTo(t);
  }

  return (
    <div className="space-y-5">
      {/* Date Filter */}
      <Panel className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">From</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
              className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent" />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">To</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
              className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent" />
          </div>
          <div className="flex gap-1.5">
            {presets.map((p) => (
              <button key={p.label} onClick={() => applyPreset(p.days)}
                className="rounded-md border border-border px-2.5 py-1.5 text-xs text-text-secondary hover:bg-surface-soft transition-colors">
                {p.label}
              </button>
            ))}
          </div>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" onClick={loadReport} disabled={loading}>
              <RefreshCw size={13} className={`mr-1 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <div className="relative group">
              <Button variant="secondary">
                <Download size={13} className="mr-1" />
                Export CSV
                <ChevronDown size={12} className="ml-1" />
              </Button>
              <div className="absolute right-0 top-full mt-1 hidden group-hover:block w-44 rounded-md border border-border bg-surface shadow-lg z-10">
                {(["shifts", "games", "inventory", "activity"] as const).map((t) => (
                  <button key={t} onClick={() => downloadCSV(t)}
                    className="block w-full px-3 py-2 text-left text-sm text-text hover:bg-surface-soft capitalize">
                    {t === "shifts"
                      ? "Shift Report"
                      : t === "games"
                        ? "Game Performance"
                        : t === "inventory"
                          ? "Inventory Snapshot"
                          : "Activity Report"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Panel>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Summary KPIs */}
      {data && (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
            <StatCard label="Gross Sales" value={fmt(data.summary.totalGross)} up={true} sub="Total revenue" />
            <StatCard label="Est. COGS" value={fmt(data.summary.totalCogs)} sub="Cost of tickets" />
            <StatCard label="Net Margin" value={fmt(data.summary.totalNet)}
              up={data.summary.totalNet >= 0} sub={`${data.summary.avgMarginPct}% avg margin`} />
            <StatCard label="Tickets Sold" value={data.summary.totalTickets.toLocaleString()} sub="Across all shifts" />
            <StatCard label="Shifts" value={String(data.summary.shiftCount)} sub="Closed in period" />
            <StatCard label="Avg / Shift" value={data.summary.shiftCount > 0 ? fmt(data.summary.totalGross / data.summary.shiftCount) : "$0"} sub="Gross per shift" />
          </div>

          {/* Tabs */}
          <Panel className="p-0 overflow-hidden">
            <div className="flex border-b border-border">
              {(["shifts", "daily", "games"] as const).map((tab) => (
                <button key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-5 py-3 text-sm font-medium capitalize transition-colors border-b-2 ${activeTab === tab ? "border-accent text-accent" : "border-transparent text-text-secondary hover:text-text"}`}>
                  {tab === "shifts" ? "Shift Log" : tab === "daily" ? "Daily Totals" : "Game Performance"}
                </button>
              ))}
            </div>

            <div className="p-4 overflow-x-auto">
              {/* Shifts Tab */}
              {activeTab === "shifts" && (
                data.shifts.length === 0 ? (
                  <p className="py-8 text-center text-sm text-text-secondary">No closed shifts in this date range.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-tertiary">
                        <th className="py-2 pr-2 w-4"></th>
                        <th className="py-2 pr-4">Date / Time</th>
                        <th className="py-2 pr-4">Opened By</th>
                        <th className="py-2 pr-4">Closed By</th>
                        <th className="py-2 pr-4 text-right">Tickets</th>
                        <th className="py-2 pr-4 text-right">Gross</th>
                        <th className="py-2 pr-4 text-right">COGS</th>
                        <th className="py-2 pr-4 text-right">Net</th>
                        <th className="py-2 text-right">Margin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.shifts.map((shift) => (
                        <>
                          <tr key={shift.id}
                            className="border-b border-border cursor-pointer hover:bg-surface-soft"
                            onClick={() => setExpandedShift(expandedShift === shift.id ? null : shift.id)}>
                            <td className="py-2.5 pr-2 text-text-tertiary">
                              {expandedShift === shift.id ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                            </td>
                            <td className="py-2.5 pr-4">
                              <p className="font-medium text-text">{shift.closedAt ? fmtDate(shift.closedAt) : "—"}</p>
                              <p className="text-xs text-text-tertiary">Opened {fmtDate(shift.openedAt)}</p>
                            </td>
                            <td className="py-2.5 pr-4 text-text-secondary">{shift.openedBy}</td>
                            <td className="py-2.5 pr-4 text-text-secondary">{shift.closedBy}</td>
                            <td className="py-2.5 pr-4 text-right tabular-nums font-medium text-text">{shift.ticketsSold}</td>
                            <td className="py-2.5 pr-4 text-right tabular-nums font-medium text-text">{fmt(shift.grossSales)}</td>
                            <td className="py-2.5 pr-4 text-right tabular-nums text-text-secondary">{fmt(shift.cogs)}</td>
                            <td className={`py-2.5 pr-4 text-right tabular-nums font-semibold ${shift.netMargin >= 0 ? "text-green-600" : "text-red-500"}`}>
                              {fmt(shift.netMargin)}
                            </td>
                            <td className="py-2.5 text-right"><MarginBar pct={shift.marginPct} /></td>
                          </tr>
                          {expandedShift === shift.id && shift.gameBreakdown.length > 0 && (
                            <tr key={`${shift.id}-expand`} className="bg-surface-soft">
                              <td colSpan={9} className="px-4 pb-3 pt-1">
                                <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary mb-2">Game Breakdown</p>
                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                                  {shift.gameBreakdown.map((g) => (
                                    <div key={g.name} className="rounded-md border border-border bg-surface p-2.5">
                                      <p className="text-xs font-medium text-text truncate">{g.name}</p>
                                      <p className="text-xs text-text-secondary mt-0.5">{g.tickets} tickets · {fmt(g.sales)}</p>
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      ))}
                    </tbody>
                  </table>
                )
              )}

              {/* Daily Tab */}
              {activeTab === "daily" && (
                data.dailyTotals.length === 0 ? (
                  <p className="py-8 text-center text-sm text-text-secondary">No data in this date range.</p>
                ) : (
                  <>
                  <div className="mb-5 rounded-lg border border-border bg-surface-soft p-3 sm:p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-sm font-semibold text-text">Sales trend</p>
                      <p className="text-xs text-text-tertiary">Daily gross sales</p>
                    </div>
                    <div className="flex h-36 items-end gap-1 overflow-x-auto sm:gap-2">
                      {[...data.dailyTotals].slice(-30).map((day) => {
                        const maxSales = Math.max(...data.dailyTotals.map((item) => item.grossSales), 1);
                        const height = Math.max((day.grossSales / maxSales) * 100, day.grossSales > 0 ? 4 : 0);
                        return (
                          <div key={day.date} className="group flex h-full min-w-5 flex-1 flex-col justify-end gap-1 sm:min-w-7">
                            <div className="relative flex h-full items-end">
                              <div className="w-full rounded-t bg-accent transition-opacity group-hover:opacity-75" style={{ height: `${height}%` }} title={`${fmtDay(day.date)}: ${fmt(day.grossSales)}`} />
                            </div>
                            <span className="truncate text-center text-[9px] text-text-tertiary">{day.date.slice(5)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-tertiary">
                        <th className="py-2 pr-4">Date</th>
                        <th className="py-2 pr-4 text-right">Shifts</th>
                        <th className="py-2 pr-4 text-right">Tickets Sold</th>
                        <th className="py-2 text-right">Gross Sales</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...data.dailyTotals].reverse().map((day) => (
                        <tr key={day.date} className="border-b border-border">
                          <td className="py-2.5 pr-4 font-medium text-text">
                            <span className="flex items-center gap-1.5">
                              <Calendar size={13} className="text-text-tertiary" />
                              {fmtDay(day.date)}
                            </span>
                          </td>
                          <td className="py-2.5 pr-4 text-right text-text-secondary">{day.shifts}</td>
                          <td className="py-2.5 pr-4 text-right tabular-nums font-medium text-text">{day.ticketsSold.toLocaleString()}</td>
                          <td className="py-2.5 text-right tabular-nums font-bold text-text">{fmt(day.grossSales)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-border bg-surface-soft font-semibold">
                        <td className="py-2.5 pr-4 text-text">Total</td>
                        <td className="py-2.5 pr-4 text-right text-text">{data.summary.shiftCount}</td>
                        <td className="py-2.5 pr-4 text-right tabular-nums text-text">{data.summary.totalTickets.toLocaleString()}</td>
                        <td className="py-2.5 text-right tabular-nums text-accent">{fmt(data.summary.totalGross)}</td>
                      </tr>
                    </tfoot>
                  </table>
                  </>
                )
              )}

              {/* Games Tab */}
              {activeTab === "games" && (
                data.gamePerformance.length === 0 ? (
                  <p className="py-8 text-center text-sm text-text-secondary">No game sales in this date range.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-tertiary">
                        <th className="py-2 pr-4">Game</th>
                        <th className="py-2 pr-4 text-right">Tickets</th>
                        <th className="py-2 pr-4 text-right">Gross</th>
                        <th className="py-2 pr-4 text-right">COGS</th>
                        <th className="py-2 pr-4 text-right">Net</th>
                        <th className="py-2 text-right">Margin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.gamePerformance.map((g, i) => (
                        <tr key={g.name} className="border-b border-border">
                          <td className="py-2.5 pr-4">
                            <div className="flex items-center gap-2">
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent/10 text-[10px] font-bold text-accent">
                                {i + 1}
                              </span>
                              <span className="font-medium text-text">{g.name}</span>
                            </div>
                          </td>
                          <td className="py-2.5 pr-4 text-right tabular-nums text-text">{g.tickets.toLocaleString()}</td>
                          <td className="py-2.5 pr-4 text-right tabular-nums font-medium text-text">{fmt(g.sales)}</td>
                          <td className="py-2.5 pr-4 text-right tabular-nums text-text-secondary">{fmt(g.cost)}</td>
                          <td className={`py-2.5 pr-4 text-right tabular-nums font-semibold ${g.netMargin >= 0 ? "text-green-600" : "text-red-500"}`}>
                            {fmt(g.netMargin)}
                          </td>
                          <td className="py-2.5 text-right"><MarginBar pct={g.marginPct} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              )}
            </div>
          </Panel>
        </>
      )}

      {loading && !data && (
        <div className="flex items-center justify-center py-16 text-text-tertiary">
          <RefreshCw size={20} className="animate-spin mr-2" /> Loading report...
        </div>
      )}
    </div>
  );
}
