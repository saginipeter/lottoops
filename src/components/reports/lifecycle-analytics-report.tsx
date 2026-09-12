"use client";

import { useEffect, useState } from "react";
import { Activity, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";

interface AnalyticsData {
  summary: {
    averageReceiptToActivationDays: number;
    averageActivationToCompletionDays: number;
    backstockExposure: number;
    activeExposure: number;
    backstockOver30Days: number;
    activeOver30Days: number;
    reassignedPacks: number;
  };
  games: Array<{ gameNumber: string; game: string; packs: number; tickets: number; value: number }>;
}

function currency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

export function LifecycleAnalyticsReport() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/reports/analytics", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to load lifecycle analytics.");
      setData(payload);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load lifecycle analytics.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <Panel className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Activity size={18} className="mt-0.5 text-accent" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">Advanced analytics</p>
            <h2 className="text-base font-semibold text-text">Pack Lifecycle & Exposure</h2>
            <p className="mt-1 text-sm text-text-secondary">Timing, aging, inventory exposure, and game movement from store history.</p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={() => { void load(); }} disabled={loading}>
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
        </Button>
      </div>
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-text-secondary"><Loader2 size={15} className="animate-spin" /> Loading analytics...</div>
      ) : data ? (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <div><p className="text-xs text-text-secondary">Receipt to activation</p><p className="mt-1 text-xl font-bold text-text">{data.summary.averageReceiptToActivationDays} days</p></div>
            <div><p className="text-xs text-text-secondary">Activation to completion</p><p className="mt-1 text-xl font-bold text-text">{data.summary.averageActivationToCompletionDays} days</p></div>
            <div><p className="text-xs text-text-secondary">Backstock exposure</p><p className="mt-1 text-xl font-bold text-text">{currency(data.summary.backstockExposure)}</p></div>
            <div><p className="text-xs text-text-secondary">Active exposure</p><p className="mt-1 text-xl font-bold text-text">{currency(data.summary.activeExposure)}</p></div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-text-secondary">
            <span className="rounded-full bg-surface-soft px-2 py-1">Backstock over 30 days: {data.summary.backstockOver30Days}</span>
            <span className="rounded-full bg-surface-soft px-2 py-1">Active over 30 days: {data.summary.activeOver30Days}</span>
            <span className="rounded-full bg-surface-soft px-2 py-1">Reassigned packs: {data.summary.reassignedPacks}</span>
          </div>
          {data.games.length === 0 ? <p className="mt-5 rounded-md border border-border bg-surface-soft px-3 py-3 text-sm text-text-secondary">No pack lifecycle records are available yet. Receive or activate a pack to populate this report.</p> : <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead><tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-tertiary"><th className="py-2 pr-3">Game</th><th className="py-2 pr-3 text-right">Packs</th><th className="py-2 pr-3 text-right">Tickets moved</th><th className="py-2 text-right">Value</th></tr></thead>
              <tbody>{data.games.map((game) => <tr key={game.gameNumber} className="border-b border-border last:border-0"><td className="py-2.5 pr-3"><span className="font-medium">{game.game}</span><span className="ml-1 text-xs text-text-tertiary">#{game.gameNumber}</span></td><td className="py-2.5 pr-3 text-right">{game.packs}</td><td className="py-2.5 pr-3 text-right">{game.tickets}</td><td className="py-2.5 text-right">{currency(game.value)}</td></tr>)}</tbody>
            </table>
          </div>}
        </>
      ) : null}
    </Panel>
  );
}
