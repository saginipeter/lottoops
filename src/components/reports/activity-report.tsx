"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Download, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { ReportActions } from "@/components/reports/report-actions";
import type { ReportDateRangeValue } from "@/components/reports/report-date-filter";
import { activityRowStatus as rowStatus, createActivityReportDocument, readableActivityAction as readableAction, summarizeActivity, type ActivityRow } from "@/lib/activity-inventory-report-documents";

const EMPTY_ROWS: ActivityRow[] = [];

export function ActivityReport({ dateRange }: { dateRange: ReportDateRangeValue }) {
  const { from, to } = dateRange;
  const [snapshot, setSnapshot] = useState<{ from: string; to: string; rows: ActivityRow[] } | null>(null);
  const [fetching, setFetching] = useState(true); const [error, setError] = useState(""); const [actionFilter, setActionFilter] = useState("ALL"); const [expandedId, setExpandedId] = useState<number | null>(null);
  const currentSnapshot = snapshot?.from === from && snapshot.to === to ? snapshot : null;
  const loading = fetching || (!currentSnapshot && !error);
  const rows = currentSnapshot?.rows ?? EMPTY_ROWS;
  const actionOptions = useMemo(() => Array.from(new Set(rows.map((row) => row.action))).sort(), [rows]);
  const visibleRows = useMemo(() => actionFilter === "ALL" ? rows : rows.filter((row) => row.action === actionFilter), [actionFilter, rows]);
  const summary = useMemo(() => summarizeActivity(visibleRows), [visibleRows]);
  const reportDocument = useMemo(() => createActivityReportDocument(visibleRows, { from, to, action: actionFilter }), [visibleRows, from, to, actionFilter]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const load = async () => {
      setFetching(true);
      setSnapshot(null);
      setExpandedId(null);
      setError("");
      try {
        const params = new URLSearchParams({ from, to });
        const res = await fetch(`/api/reports/activity?${params}`, { signal: controller.signal });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Unable to load activity.");
        if (active) setSnapshot({ from, to, rows: data.logs ?? [] });
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Unable to load activity.");
      } finally {
        if (active) setFetching(false);
      }
    };
    void load();
    return () => { active = false; controller.abort(); };
  }, [from, to]);

  const metrics = [["Total events", summary.total], ["Users involved", summary.people], ["Terminals", summary.terminals || "—"], ["Corrections", summary.corrections], ["Exceptions", summary.exceptions]];
  return <Panel className="overflow-hidden p-0">
    <div className="border-b border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-start gap-2"><History size={18} className="mt-0.5 text-accent" /><div><p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">Manager review</p><h2 className="text-base font-semibold text-text">Activity Report</h2><p className="mt-1 text-sm text-text-secondary">A clear record of what happened, when, where, and who performed it.</p></div></div><div className="flex flex-wrap gap-2"><label className="sr-only" htmlFor="activity-type">Filter by action type</label><select id="activity-type" value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className="min-h-10 rounded-md border border-border bg-surface px-3 py-1.5 text-sm"><option value="ALL">All activity</option>{actionFilter !== "ALL" && !actionOptions.includes(actionFilter) && <option value={actionFilter}>{readableAction(actionFilter)}</option>}{actionOptions.map((action) => <option key={action} value={action}>{readableAction(action)}</option>)}</select><Button variant="outline" onClick={() => window.open(`/api/reports/export?type=activity&from=${from}&to=${to}`, "_blank")}><Download size={13} /> Export CSV</Button><ReportActions document={reportDocument} disabled={loading || !!error} /></div></div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">{metrics.map(([label, value]) => <div key={label} className="rounded-md bg-surface-soft px-3 py-2"><p className="text-[10px] uppercase tracking-wide text-text-tertiary">{label}</p><p className="mt-1 text-lg font-semibold text-text">{value}</p></div>)}</div>
    </div>
    <div className="overflow-x-auto p-4">{error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700">{error}</p> : <table className="w-full min-w-[680px] text-sm"><caption className="sr-only">Inventory and operations activity for the selected date range</caption><thead><tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-tertiary"><th className="py-2 pr-3">When</th><th className="py-2 pr-3">What happened</th><th className="py-2 pr-3">Completed by</th><th className="py-2 pr-3">Terminal</th><th className="py-2 pr-3">Status</th><th className="py-2 text-right">Details</th></tr></thead><tbody>{!loading && visibleRows.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-text-secondary">No activity found for this date range.</td></tr>}{visibleRows.map((row) => { const status = rowStatus(row.action); const expanded = expandedId === row.id; return <tr key={row.id} className="border-b border-border align-top"><td className="py-3 pr-3 text-xs whitespace-nowrap">{new Date(row.createdAt).toLocaleString()}</td><td className="py-3 pr-3 font-medium">{readableAction(row.action)}</td><td className="py-3 pr-3">{row.performedByName ?? row.performedById}</td><td className="py-3 pr-3">{row.terminalId ?? "—"}</td><td className="py-3 pr-3"><span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${status.className}`}>{status.label}</span></td><td className="py-3 text-right"><button type="button" aria-expanded={expanded} onClick={() => setExpandedId(expanded ? null : row.id)} className="inline-flex min-h-10 items-center gap-1 text-xs font-medium text-accent hover:underline"><ChevronDown size={13} className={expanded ? "rotate-180" : ""} />{expanded ? "Hide details" : "View details"}</button>{expanded && <div className="mt-2 max-w-xs text-left text-xs text-text-secondary"><p>{row.detail}</p><p className="mt-1 font-mono text-[10px] text-text-tertiary">Event ID {row.id} · {row.action}</p></div>}</td></tr>; })}</tbody></table>}</div>
  </Panel>;
}
