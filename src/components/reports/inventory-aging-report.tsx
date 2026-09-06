"use client";

import { useEffect, useState } from "react";
import { Clock3, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";

interface AgingPack { id: string; serialNumber: string; game: string; gameNumber: string; status: string; display: string | null; receivedAt: string; activatedAt: string | null; ageDays: number; }

export function InventoryAgingReport() {
  const [packs, setPacks] = useState<AgingPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/reports/aging", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load inventory aging.");
      setPacks(data.packs ?? []);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to load inventory aging."); }
    finally { setLoading(false); }
  }

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, []);

  return <Panel className="p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-start gap-2"><Clock3 size={18} className="mt-0.5 text-accent" /><div><p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">Inventory analytics</p><h2 className="text-base font-semibold text-text">Inventory Aging</h2><p className="mt-1 text-sm text-text-secondary">Oldest Back Stock and Active display packs by age.</p></div></div><Button size="sm" variant="outline" onClick={() => { void load(); }} disabled={loading}><RefreshCw size={13} className={loading ? "animate-spin" : ""} />Refresh</Button></div>{error && <p className="mt-3 text-sm text-red-700">{error}</p>}{loading ? <div className="mt-4 flex items-center gap-2 text-sm text-text-secondary"><Loader2 size={15} className="animate-spin" />Loading aging...</div> : packs.length === 0 ? <p className="mt-4 text-sm text-text-secondary">No active or backstock packs found.</p> : <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[650px] text-sm"><thead><tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-tertiary"><th className="py-2 pr-3">Pack / Game</th><th className="py-2 pr-3">Status</th><th className="py-2 pr-3">Display</th><th className="py-2 pr-3">Received</th><th className="py-2">Age</th></tr></thead><tbody>{packs.slice().sort((a, b) => b.ageDays - a.ageDays).map((pack) => <tr key={pack.id} className="border-b border-border last:border-0"><td className="py-2.5 pr-3"><span className="font-mono text-xs">{pack.serialNumber}</span><br /><span className="text-xs text-text-secondary">{pack.game} · #{pack.gameNumber}</span></td><td className="py-2.5 pr-3"><span className="rounded-full bg-surface-soft px-2 py-1 text-[11px] font-semibold">{pack.status.replaceAll("_", " ")}</span></td><td className="py-2.5 pr-3 text-text-secondary">{pack.display ?? "Back Stock"}</td><td className="py-2.5 pr-3 text-xs text-text-tertiary">{new Date(pack.receivedAt).toLocaleDateString()}</td><td className={`py-2.5 font-semibold ${pack.ageDays >= 30 ? "text-red-700" : pack.ageDays >= 14 ? "text-amber-700" : "text-emerald-700"}`}>{pack.ageDays} days</td></tr>)}</tbody></table></div>}</Panel>;
}
