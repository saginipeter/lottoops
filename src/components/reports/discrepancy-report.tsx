"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";

interface DiscrepancyRow {
  id: string;
  type: string;
  status: string;
  game: string;
  pack: string;
  display: string;
  expected: number | null;
  observed: number | null;
  variance: number | null;
  timestamp: string | null;
  actor: string;
  reason: string;
  resolvedBy?: string | null;
}

export function DiscrepancyReport() {
  const [rows, setRows] = useState<DiscrepancyRow[]>([]);
  const [filter, setFilter] = useState<"ALL" | "UNRESOLVED" | "RESOLVED">("ALL");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/reports/discrepancies");
      if (!response.ok) return;
      const data = await response.json();
      setRows([...(data.unresolved ?? []), ...(data.auditVariances ?? [])]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const visibleRows = useMemo(
    () => filter === "ALL" ? rows : rows.filter((row) => row.status === filter),
    [filter, rows]
  );

  async function resolve(row: DiscrepancyRow) {
    const reason = window.prompt("Enter the resolution reason (at least 6 characters):");
    if (!reason || reason.trim().length < 6) return;
    const response = await fetch("/api/reports/discrepancies/resolve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: row.type, id: row.id, reason }) });
    if (!response.ok) { const data = await response.json().catch(() => ({})); window.alert(data.error || "Unable to resolve discrepancy."); return; }
    await load();
  }

  return (
    <Panel className="p-4">
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <div>
          <p className="text-xs font-semibold uppercase text-text-tertiary">Discrepancy Review</p>
          <p className="text-sm text-text-secondary">Exceptions requiring investigation or manager review.</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <label htmlFor="discrepancy-filter" className="text-xs font-medium text-text-secondary">Filter</label>
          <select id="discrepancy-filter" value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)} className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm">
            <option value="ALL">All Discrepancies</option>
            <option value="UNRESOLVED">Unsolved / Unresolved</option>
            <option value="RESOLVED">Solved / Resolved</option>
          </select>
          <Button size="sm" variant="outline" onClick={load} disabled={loading} aria-label="Refresh discrepancies"><RefreshCw size={14} /></Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-tertiary"><th className="py-2 pr-3">Status</th><th className="py-2 pr-3">Pack / Game</th><th className="py-2 pr-3">Display</th><th className="py-2 pr-3">Expected</th><th className="py-2 pr-3">Observed</th><th className="py-2 pr-3">Variance</th><th className="py-2 pr-3">Time / Actor</th><th className="py-2">Reason</th></tr></thead>
          <tbody>
            {!loading && visibleRows.length === 0 && <tr><td colSpan={8} className="py-8 text-center text-text-secondary">No discrepancies found.</td></tr>}
            {visibleRows.map((row) => <tr key={`${row.type}-${row.id}`} className="border-b border-border"><td className="py-2 pr-3"><span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${row.status === "RESOLVED" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{row.status === "RESOLVED" ? "RESOLVED" : <><AlertTriangle size={13} />UNRESOLVED</>}</span></td><td className="py-2 pr-3"><span className="font-mono text-xs">{row.pack}</span><br /><span className="text-xs text-text-secondary">{row.game}</span></td><td className="py-2 pr-3">{row.display}</td><td className="py-2 pr-3">{row.expected ?? "-"}</td><td className="py-2 pr-3">{row.observed ?? "-"}</td><td className="py-2 pr-3 font-semibold">{row.variance ?? "-"}</td><td className="py-2 pr-3 text-xs">{row.timestamp ? new Date(row.timestamp).toLocaleString() : "-"}<br />{row.actor}</td><td className="py-2 text-xs text-text-secondary">{row.reason}{row.resolvedBy && <><br />Resolved by {row.resolvedBy}</>}{row.status !== "RESOLVED" && <button type="button" onClick={() => { void resolve(row); }} className="mt-2 block rounded border border-accent px-2 py-1 text-[11px] font-semibold text-accent">Resolve</button>}</td></tr>)}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
