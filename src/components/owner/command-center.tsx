"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, AlertTriangle, BarChart3, Boxes, CheckCircle2, Clock3, Loader2, RefreshCw, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";

interface StoreRow {
  id: string;
  name: string;
  storeNumber: string | null;
  sales: number;
  tickets: number;
  activePacks: number;
  backstockPacks: number;
  lockedPacks: number;
  openShifts: number;
}
interface OverviewStore { id: string; name: string; salesToday: number; ticketsToday: number; activePacks: number; backstock: number; lockedPacks: number; openShift: boolean; }
interface Summary { salesToday: number; ticketsToday: number; activePacks: number; backstockPacks: number; lockedPacks: number; openShifts: number; auditCompletionRate: number; openExceptions: number; }
interface InventoryRow { store: string; game: string; gameNumber: string; serialNumber: string; status: string; display: string; currentTicket: number | null; ageDays: number; }

function money(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value); }

export function CommandCenter({ enabled, planKey }: { enabled: boolean; planKey: string | null }) {
  const [stores, setStores] = useState<OverviewStore[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [comparison, setComparison] = useState<StoreRow[]>([]);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const today = new Date().toISOString().slice(0, 10);
      const [overviewResponse, comparisonResponse, inventoryResponse] = await Promise.all([
        fetch("/api/owner/overview", { cache: "no-store" }),
        fetch(`/api/owner/comparison?from=${today}&to=${today}`, { cache: "no-store" }),
        fetch("/api/owner/inventory?status=ACTIVE", { cache: "no-store" }),
      ]);
      const [overview, comparisonData, inventoryData] = await Promise.all([overviewResponse.json(), comparisonResponse.json(), inventoryResponse.json()]);
      if (!overviewResponse.ok) throw new Error(overview.error || "Unable to load centralized overview.");
      if (!comparisonResponse.ok) throw new Error(comparisonData.error || "Unable to load store analytics.");
      if (!inventoryResponse.ok) throw new Error(inventoryData.error || "Unable to load centralized inventory.");
      setStores(overview.stores ?? []); setSummary(overview.summary ?? null); setComparison(comparisonData.stores ?? []); setInventory((inventoryData.packs ?? []).slice(0, 12)); setUpdatedAt(overview.generatedAt ?? new Date().toISOString());
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to load COMMAND Center."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); const timer = window.setInterval(() => { void load(); }, 15000); return () => window.clearInterval(timer); }, [load]);

  if (!enabled) return <Panel className="mx-auto max-w-3xl border-2 border-amber-200 bg-amber-50 p-7"><div className="flex items-start gap-4"><div className="flex h-12 w-12 shrink-0 items-center justify-center bg-amber-200 text-amber-900"><Boxes size={24} /></div><div><p className="text-xs font-black uppercase tracking-[0.18em] text-amber-800">COMMAND tier required</p><h1 className="mt-2 text-2xl font-black text-[#17233f]">Centralized multi-store oversight is locked</h1><p className="mt-3 text-sm leading-6 text-amber-900">This workspace consolidates inventory, sales, shifts, and exception signals across all stores. Upgrade the organization to COMMAND to enable it.</p><a href="/admin/billing" className="mt-5 inline-flex min-h-11 items-center justify-center bg-[#087da8] px-5 text-sm font-black text-white">Review subscription</a></div></div></Panel>;

  const kpis: Array<[string, string, LucideIcon, string]> = [
    ["Sales today", summary ? money(summary.salesToday) : "$0", TrendingUp, "text-emerald-700 bg-emerald-50"],
    ["Tickets", summary?.ticketsToday.toLocaleString() ?? "0", BarChart3, "text-blue-700 bg-blue-50"],
    ["Active packs", summary?.activePacks.toLocaleString() ?? "0", Boxes, "text-indigo-700 bg-indigo-50"],
    ["Back stock", summary?.backstockPacks.toLocaleString() ?? "0", Boxes, "text-purple-700 bg-purple-50"],
    ["Open shifts", summary?.openShifts.toLocaleString() ?? "0", Clock3, "text-orange-700 bg-orange-50"],
    ["Audit rate", `${summary?.auditCompletionRate ?? 0}%`, CheckCircle2, "text-teal-700 bg-teal-50"],
    ["Locked packs", summary?.lockedPacks.toLocaleString() ?? "0", AlertTriangle, "text-red-700 bg-red-50"],
    ["Open exceptions", summary?.openExceptions.toLocaleString() ?? "0", Activity, "text-rose-700 bg-rose-50"],
  ];

  return <div className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-[#087da8]">COMMAND · {planKey ?? "Multi-store"}</p><h1 className="mt-1 text-3xl font-black tracking-tight text-[#17233f]">Central operations center</h1><p className="mt-1 text-sm text-slate-500">One live view of inventory, sales, shifts, and risk across your stores.</p></div><Button size="sm" variant="outline" onClick={() => { void load(); }} disabled={loading}><RefreshCw size={14} className={loading ? "animate-spin" : ""} />Refresh</Button></div>
    {error && <p className="border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
    {loading && !summary ? <div className="flex items-center gap-2 py-10 text-sm text-slate-500"><Loader2 size={17} className="animate-spin" />Loading centralized operations...</div> : <>
      {summary && <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">{kpis.map(([label, value, StatIcon, tone]) => <Panel key={label} className="p-3"><div className={`mb-2 inline-flex p-2 ${tone}`}><StatIcon size={15} /></div><p className="text-xl font-black text-[#17233f]">{value}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p></Panel>)}</div>}
      <div className="grid gap-5 xl:grid-cols-[1.25fr_1fr]">
        <Panel className="overflow-hidden p-0"><div className="flex items-center justify-between border-b border-slate-200 px-4 py-4"><div><p className="text-xs font-black uppercase tracking-wide text-slate-500">Store performance</p><h2 className="mt-1 text-lg font-black text-[#17233f]">Today by location</h2></div><span className="text-xs font-semibold text-slate-400">{stores.length} stores</span></div><div className="overflow-x-auto"><table className="w-full min-w-[640px] text-sm"><thead><tr className="border-b border-slate-100 text-left text-[10px] font-black uppercase tracking-wide text-slate-400"><th className="px-4 py-3">Store</th><th className="px-3 py-3 text-right">Sales</th><th className="px-3 py-3 text-right">Tickets</th><th className="px-3 py-3 text-right">Active</th><th className="px-3 py-3 text-right">Risk</th></tr></thead><tbody>{comparison.map((row) => <tr key={row.id} className="border-b border-slate-100 last:border-0"><td className="px-4 py-3 font-bold text-[#17233f]">{row.name}<span className="ml-1 text-xs font-normal text-slate-400">{row.storeNumber ?? ""}</span></td><td className="px-3 py-3 text-right font-bold text-emerald-700">{money(row.sales)}</td><td className="px-3 py-3 text-right text-slate-600">{row.tickets}</td><td className="px-3 py-3 text-right text-slate-600">{row.activePacks}</td><td className={`px-3 py-3 text-right font-bold ${row.lockedPacks ? "text-red-700" : "text-emerald-700"}`}>{row.lockedPacks || "Clear"}</td></tr>)}</tbody></table></div></Panel>
        <Panel className="overflow-hidden p-0"><div className="border-b border-slate-200 px-4 py-4"><p className="text-xs font-black uppercase tracking-wide text-slate-500">Live inventory</p><h2 className="mt-1 text-lg font-black text-[#17233f]">Active packs across stores</h2></div><div className="divide-y divide-slate-100">{inventory.length === 0 ? <p className="px-4 py-8 text-sm text-slate-500">No active packs found.</p> : inventory.map((pack) => <div key={`${pack.store}-${pack.serialNumber}`} className="flex items-center justify-between gap-3 px-4 py-3"><div className="min-w-0"><p className="truncate text-sm font-bold text-[#17233f]">{pack.store} · #{pack.gameNumber} {pack.game}</p><p className="mt-0.5 font-mono text-[10px] text-slate-500">{pack.serialNumber} {pack.display ? `· Display ${pack.display}` : ""}</p></div><span className={`shrink-0 px-2 py-1 text-xs font-black ${pack.currentTicket !== null && pack.currentTicket <= 5 ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"}`}>{pack.currentTicket ?? "—"} left</span></div>)}</div></Panel>
      </div>
      <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400"><span>Automatic refresh every 15 seconds</span><span>Updated {updatedAt ? new Date(updatedAt).toLocaleTimeString() : "—"}</span></div>
    </>}
  </div>;
}
