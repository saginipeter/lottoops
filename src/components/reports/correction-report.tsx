"use client";

import { useEffect, useState } from "react";
import { History, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";

interface Correction {
  id: string;
  entityType: string;
  entityId: string;
  fieldName: string;
  oldValue: string | null;
  newValue: string;
  reason: string;
  correctedByName: string | null;
  createdAt: string;
}

export function CorrectionReport() {
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/reports/corrections", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load correction history.");
      setCorrections(data.corrections ?? []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load correction history.");
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <History size={18} className="mt-0.5 text-accent" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">Protected changes</p>
            <h2 className="text-base font-semibold text-text">Correction History</h2>
            <p className="mt-1 text-sm text-text-secondary">Original values, corrected values, reasons, and approvers.</p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={() => { void load(); }} disabled={loading} aria-label="Refresh correction history">
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
        </Button>
      </div>
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      {loading ? <div className="mt-4 flex items-center gap-2 text-sm text-text-secondary"><Loader2 size={15} className="animate-spin" /> Loading correction history...</div> : corrections.length === 0 ? <p className="mt-4 text-sm text-text-secondary">No protected corrections recorded.</p> : <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead><tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-tertiary"><th className="py-2 pr-3">Time</th><th className="py-2 pr-3">Entity</th><th className="py-2 pr-3">Field</th><th className="py-2 pr-3">Original</th><th className="py-2 pr-3">Corrected</th><th className="py-2 pr-3">Reason</th><th className="py-2">By</th></tr></thead><tbody>{corrections.map((correction) => <tr key={correction.id} className="border-b border-border last:border-0"><td className="whitespace-nowrap py-2.5 pr-3 text-xs text-text-tertiary">{new Date(correction.createdAt).toLocaleString()}</td><td className="py-2.5 pr-3"><span className="font-mono text-xs">{correction.entityId}</span><br /><span className="text-xs text-text-secondary">{correction.entityType}</span></td><td className="py-2.5 pr-3 text-text-secondary">{correction.fieldName}</td><td className="py-2.5 pr-3 text-red-700">{correction.oldValue ?? "-"}</td><td className="py-2.5 pr-3 font-semibold text-emerald-700">{correction.newValue}</td><td className="max-w-64 py-2.5 pr-3 text-xs text-text-secondary">{correction.reason}</td><td className="py-2.5 text-text-secondary">{correction.correctedByName ?? "Unknown"}</td></tr>)}</tbody></table></div>}
    </Panel>
  );
}
