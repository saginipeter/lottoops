"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Package, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { ReportActions } from "@/components/reports/report-actions";
import { buildBackStockSummaryDocument, type BackStockSummary } from "@/lib/back-stock-report";

const EMPTY_SUMMARY: BackStockSummary = { generatedAt: "", totalPackQuantity: 0, totalRetailValue: 0, costPayout95: 0 };
const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

export function BackStockSummaryReport() {
  const [summary, setSummary] = useState<BackStockSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load(signal?: AbortSignal) {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/reports/back-stock", { cache: "no-store", signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load Back Stock totals.");
      setSummary({
        generatedAt: String(data.generatedAt ?? ""),
        totalPackQuantity: Number(data.totalPackQuantity ?? 0),
        totalRetailValue: Number(data.totalRetailValue ?? 0),
        costPayout95: Number(data.costPayout95 ?? 0),
      });
    } catch (reason) {
      if (signal?.aborted) return;
      setError(reason instanceof Error ? reason.message : "Unable to load Back Stock totals.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, []);

  const reportDocument = useMemo(() => buildBackStockSummaryDocument(summary ?? EMPTY_SUMMARY), [summary]);

  return <Panel className="p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-2"><Package size={18} className="mt-0.5 text-accent" /><div>
        <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">Inventory report</p>
        <h2 className="text-base font-semibold text-text">Back Stock Summary</h2>
        <p className="mt-1 text-sm text-text-secondary">Current packs held in back stock, their face value, and the 95% cost payout.</p>
      </div></div>
      <Button size="sm" variant="outline" onClick={() => { void load(); }} disabled={loading}><RefreshCw size={13} className={loading ? "animate-spin" : ""} />Refresh</Button>
    </div>
    {error && <div className="mt-3 flex items-center justify-between gap-3 border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert"><span>{error}</span><button type="button" className="font-bold underline" onClick={() => { void load(); }}>Retry</button></div>}
    {loading ? <div className="mt-4 flex items-center gap-2 text-sm text-text-secondary" role="status"><Loader2 size={15} className="animate-spin" />Loading Back Stock totals…</div> : summary && <>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Total Pack Quantity" value={summary.totalPackQuantity.toLocaleString()} />
        <SummaryCard label="Total Retail Value (100%)" value={money(summary.totalRetailValue)} />
        <SummaryCard label="Cost Payout (95%)" value={money(summary.costPayout95)} />
      </div>
      <div className="mt-4"><ReportActions document={reportDocument} disabled={!!error} /></div>
    </>}
  </Panel>;
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return <div className="border border-border bg-surface-soft p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-text-tertiary">{label}</p><p className="mt-1 text-xl font-black tabular-nums text-text">{value}</p></div>;
}
