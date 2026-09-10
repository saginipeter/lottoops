"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";

interface ActivityRow {
  id: number;
  action: string;
  entityType: string;
  entityId?: string | null;
  detail: string;
  performedById: string;
  performedByName?: string | null;
  terminalId?: string | null;
  createdAt: string;
}

export function ActivityReport() {
  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  const [from, setFrom] = useState(thirtyDaysAgo);
  const [to, setTo] = useState(today);
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/reports/activity?from=${from}&to=${to}`);
        const data = await res.json();
        if (!active) return;
        setRows(data.logs ?? []);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [from, to]);

  return (
    <Panel className="p-4">
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <div>
          <p className="text-xs font-semibold uppercase text-text-tertiary">Activity Report</p>
          <p className="text-sm text-text-secondary">Track ticket updates and inventory actions by manager/staff.</p>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm" />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm" />
          <Button variant="outline" onClick={() => window.open(`/api/reports/export?type=activity&from=${from}&to=${to}`, "_blank")}>
            Export CSV
          </Button>
          <Button variant="secondary" onClick={() => window.print()}>
            Print
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-tertiary">
              <th className="py-2 pr-3">Timestamp</th>
              <th className="py-2 pr-3">Action</th>
              <th className="py-2 pr-3">Entity</th>
              <th className="py-2 pr-3">Detail</th>
              <th className="py-2 pr-3">Performed By</th>
              <th className="py-2 pr-3">Terminal</th>
            </tr>
          </thead>
          <tbody>
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-text-secondary">
                  No activity found for this date range.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-border">
                <td className="py-2 pr-3 text-xs">{new Date(row.createdAt).toLocaleString()}</td>
                <td className="py-2 pr-3">{row.action}</td>
                <td className="py-2 pr-3">{row.entityType}{row.entityId ? ` (${row.entityId})` : ""}</td>
                <td className="py-2 pr-3">{row.detail}</td>
                <td className="py-2 pr-3">{row.performedByName ?? row.performedById}</td>
                <td className="py-2 pr-3">{row.terminalId ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
