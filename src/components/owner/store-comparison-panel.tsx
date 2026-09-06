"use client";

import { useEffect, useState } from "react";
import { BarChart3, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";

interface ComparisonRow { id: string; name: string; storeNumber: string | null; sales: number; tickets: number; activePacks: number; backstockPacks: number; lockedPacks: number; openShifts: number; }

function currency(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value); }

export function StoreComparisonPanel() {
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [rows, setRows] = useState<ComparisonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/owner/comparison?from=${from}&to=${to}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load comparison.");
      setRows(data.stores ?? []);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to load comparison."); }
    finally { setLoading(false); }
  }

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [from, to]);

  return <Panel className="p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-start gap-2"><BarChart3 size={18} className="mt-0.5 text-accent" /><div><h2 className="text-base font-semibold text-text">Store Comparison</h2><p className="mt-1 text-sm text-text-secondary">Compare sales and inventory across authorized locations.</p></div></div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => { void load(); }} disabled={loading}><RefreshCw size={13} className={loading ? "animate-spin" : ""} />Refresh</Button><Button size="sm" variant="secondary" onClick={() => window.open(`/api/owner/comparison?from=${from}&to=${to}&format=csv`, "_blank")}>Export CSV</Button></div></div><div className="mt-4 flex flex-wrap items-end gap-3"><label className="text-xs font-medium text-text-secondary">From<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="mt-1 block rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-text" /></label><label className="text-xs font-medium text-text-secondary">To<input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="mt-1 block rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-text" /></label></div>{error && <p className="mt-3 text-sm text-red-700">{error}</p>}{loading ? <div className="mt-5 flex items-center gap-2 text-sm text-text-secondary"><Loader2 size={16} className="animate-spin" />Loading comparison...</div> : <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[720px] text-sm"><thead><tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-tertiary"><th className="py-2 pr-3">Store</th><th className="py-2 pr-3 text-right">Sales</th><th className="py-2 pr-3 text-right">Tickets</th><th className="py-2 pr-3 text-right">Active</th><th className="py-2 pr-3 text-right">Backstock</th><th className="py-2 pr-3 text-right">Locked</th><th className="py-2 text-right">Open shifts</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-b border-border last:border-0"><td className="py-2.5 pr-3 font-medium text-text">{row.name}{row.storeNumber ? <span className="ml-1 text-xs text-text-tertiary">({row.storeNumber})</span> : null}</td><td className="py-2.5 pr-3 text-right font-semibold text-text">{currency(row.sales)}</td><td className="py-2.5 pr-3 text-right text-text-secondary">{row.tickets}</td><td className="py-2.5 pr-3 text-right text-text-secondary">{row.activePacks}</td><td className="py-2.5 pr-3 text-right text-text-secondary">{row.backstockPacks}</td><td className="py-2.5 pr-3 text-right text-red-700">{row.lockedPacks}</td><td className="py-2.5 text-right text-text-secondary">{row.openShifts}</td></tr>)}</tbody></table></div>}</Panel>;
}
