"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Download, History } from "lucide-react";
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

const ACTION_LABELS: Record<string, string> = {
  LIVE_TICKET_SCAN: "Ticket scanned",
  SEQUENCE_LOCK_SELF_RESOLVED: "Employee corrected sequence",
  SEQUENCE_LOCK_RESOLVED: "Sequence issue resolved",
  SHIFT_OPEN: "Shift opened",
  SHIFT_CLOSE: "Shift closed",
  UPDATE_TICKET_NUMBER: "Ticket position corrected",
  RECEIVED: "Pack received",
  ACTIVATED: "Pack activated",
  SOLD_OUT: "Pack sold out",
};

function readableAction(action: string) {
  return ACTION_LABELS[action] ?? action.replaceAll("_", " ").toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase());
}

export function ActivityReport() {
  const [dateRange] = useState(() => {
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 86400000);
    return {
      today: today.toISOString().slice(0, 10),
      thirtyDaysAgo: thirtyDaysAgo.toISOString().slice(0, 10),
    };
  });

  const [from, setFrom] = useState(dateRange.thirtyDaysAgo);
  const [to, setTo] = useState(dateRange.today);
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionFilter, setActionFilter] = useState("ALL");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const actionOptions = useMemo(() => Array.from(new Set(rows.map((row) => row.action))).sort(), [rows]);
  const visibleRows = useMemo(
    () => actionFilter === "ALL" ? rows : rows.filter((row) => row.action === actionFilter),
    [actionFilter, rows]
  );
  const summary = useMemo(() => ({
    total: rows.length,
    people: new Set(rows.map((row) => row.performedByName ?? row.performedById)).size,
    terminals: new Set(rows.map((row) => row.terminalId).filter(Boolean)).size,
  }), [rows]);

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
    <Panel className="overflow-hidden p-0">
      <div className="border-b border-border p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <History size={18} className="mt-0.5 text-accent" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">Manager review</p>
              <h2 className="text-base font-semibold text-text">Activity Report</h2>
              <p className="mt-1 text-sm text-text-secondary">A simple record of who changed what and when.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm" />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm" />
          <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm">
            <option value="ALL">All activity</option>
            {actionOptions.map((action) => <option key={action} value={action}>{readableAction(action)}</option>)}
          </select>
          <Button variant="outline" onClick={() => window.open(`/api/reports/export?type=activity&from=${from}&to=${to}`, "_blank")}>
            <Download size={13} /> Export CSV
          </Button>
          <Button variant="secondary" onClick={() => window.print()}>
            Print
          </Button>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 sm:max-w-xl">
          <div className="rounded-md bg-surface-soft px-3 py-2"><p className="text-[10px] uppercase tracking-wide text-text-tertiary">Events</p><p className="mt-1 text-lg font-semibold text-text">{summary.total}</p></div>
          <div className="rounded-md bg-surface-soft px-3 py-2"><p className="text-[10px] uppercase tracking-wide text-text-tertiary">People</p><p className="mt-1 text-lg font-semibold text-text">{summary.people}</p></div>
          <div className="rounded-md bg-surface-soft px-3 py-2"><p className="text-[10px] uppercase tracking-wide text-text-tertiary">Terminals</p><p className="mt-1 text-lg font-semibold text-text">{summary.terminals || "—"}</p></div>
        </div>
      </div>

      <div className="overflow-x-auto p-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-tertiary">
              <th className="py-2 pr-3">Timestamp</th>
              <th className="py-2 pr-3">What happened</th>
              <th className="py-2 pr-3">Record</th>
              <th className="py-2 pr-3">Completed by</th>
              <th className="py-2 pr-3">Terminal</th>
              <th className="py-2 text-right">Details</th>
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
            {visibleRows.map((row) => (
              <tr key={row.id} className="border-b border-border">
                <td className="py-2 pr-3 text-xs">{new Date(row.createdAt).toLocaleString()}</td>
                <td className="py-2 pr-3 font-medium">{readableAction(row.action)}</td>
                <td className="py-2 pr-3">{row.entityType}{row.entityId ? <span className="ml-1 text-xs text-text-tertiary">#{row.entityId}</span> : ""}</td>
                <td className="py-2 pr-3">{row.performedByName ?? row.performedById}</td>
                <td className="py-2 pr-3">{row.terminalId ?? "—"}</td>
                <td className="py-2 text-right"><button type="button" onClick={() => setExpandedId(expandedId === row.id ? null : row.id)} className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"><ChevronDown size={13} className={expandedId === row.id ? "rotate-180" : ""} />{expandedId === row.id ? "Hide" : "View"}</button>{expandedId === row.id && <p className="mt-2 max-w-xs text-left text-xs text-text-secondary">{row.detail}</p>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
