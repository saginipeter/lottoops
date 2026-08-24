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
}

export function DiscrepancyReport() {
  const [rows, setRows] = useState<DiscrepancyRow[]>([]);
  const [filter, setFilter] = useState<"ALL" | "UNRESOLVED" | "REVIEW">("ALL");
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

  return (
    <Panel className="p-4">
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <div>
          <p className="text-xs font-semibold uppercase text-text-tertiary">Discrepancy Review</p>
          <p className="text-sm text-text-secondary">Exceptions requiring investigation or manager review.</p>
        </div>
        <div className="ml-auto flex gap-2">
          {(["ALL", "UNRESOLVED", "REVIEW"] as const).map((value) => (
            <Button key={value} size="sm" variant={filter === value ? "secondary" : "outline"} onClick={() => setFilter(value)}>
              {value === "ALL" ? "All" : value === "UNRESOLVED" ? "Unresolved" : "Audit Review"}
            </Button>
          ))}
          <Button size="sm" variant="outline" onClick={load} disabled={loading} aria-label="Refresh discrepancies"><RefreshCw size={14} /></Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-tertiary"><th className="py-2 pr-3">Status</th><th className="py-2 pr-3">Pack / Game</th><th className="py-2 pr-3">Display</th><th className="py-2 pr-3">Expected</th><th className="py-2 pr-3">Observed</th><th className="py-2 pr-3">Variance</th><th className="py-2 pr-3">Time / Actor</th><th className="py-2">Reason</th></tr></thead>
          <tbody>
            {!loading && visibleRows.length === 0 && <tr><td colSpan={8} className="py-8 text-center text-text-secondary">No discrepancies found.</td></tr>}
            {visibleRows.map((row) => <tr key={`${row.type}-${row.id}`} className="border-b border-border"><td className="py-2 pr-3"><span className="inline-flex items-center gap-1 font-semibold text-red-700"><AlertTriangle size={13} />{row.status}</span></td><td className="py-2 pr-3"><span className="font-mono text-xs">{row.pack}</span><br /><span className="text-xs text-text-secondary">{row.game}</span></td><td className="py-2 pr-3">{row.display}</td><td className="py-2 pr-3">{row.expected ?? "-"}</td><td className="py-2 pr-3">{row.observed ?? "-"}</td><td className="py-2 pr-3 font-semibold">{row.variance ?? "-"}</td><td className="py-2 pr-3 text-xs">{row.timestamp ? new Date(row.timestamp).toLocaleString() : "-"}<br />{row.actor}</td><td className="py-2 text-xs text-text-secondary">{row.reason}</td></tr>)}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
