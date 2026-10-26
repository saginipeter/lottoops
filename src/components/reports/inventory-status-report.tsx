"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { ReportActions } from "@/components/reports/report-actions";
import type { ReportDateRangeValue } from "@/components/reports/report-date-filter";
import { createInventoryStatusReportDocument, type InventoryReportRow as PackRow, type PackStatus } from "@/lib/activity-inventory-report-documents";

const EMPTY_ROWS: PackRow[] = [];
const EMPTY_COUNTS: Record<string, number> = {};

export function InventoryStatusReport({ dateRange }: { dateRange: ReportDateRangeValue }) {
  const [status, setStatus] = useState<PackStatus>("ALL");
  const [q, setQ] = useState("");
  const [snapshot, setSnapshot] = useState<{ status: PackStatus; q: string; from: string; to: string; rows: PackRow[]; counts: Record<string, number> } | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const search = q.trim();
  const currentSnapshot = snapshot?.status === status && snapshot.q === search && snapshot.from === dateRange.from && snapshot.to === dateRange.to ? snapshot : null;
  const loading = fetching || (!currentSnapshot && !error);
  const rows = currentSnapshot?.rows ?? EMPTY_ROWS;
  const counts = currentSnapshot?.counts ?? EMPTY_COUNTS;

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const load = async () => {
      setFetching(true);
      setSnapshot(null);
      setError("");
      try {
        const params = new URLSearchParams({ status, from: dateRange.from, to: dateRange.to });
        if (search) params.set("q", search);
        const res = await fetch(`/api/reports/inventory-status?${params.toString()}`, { signal: controller.signal });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Unable to load inventory status.");
        if (!active) return;
        setSnapshot({ status, q: search, from: dateRange.from, to: dateRange.to, rows: data.packs ?? [], counts: data.counts ?? {} });
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Unable to load inventory status.");
      } finally {
        if (active) setFetching(false);
      }
    };
    load();
    return () => {
      active = false;
      controller.abort();
    };
  }, [status, search, dateRange.from, dateRange.to]);

  const totalRetail = useMemo(
    () => rows.reduce((sum, row) => sum + Number(row.retailValue ?? 0), 0),
    [rows]
  );
  const reportDocument = useMemo(
    () => createInventoryStatusReportDocument(rows, counts, { status, q: search }),
    [rows, counts, status, search]
  );

  return (
    <Panel className="p-4">
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <div>
          <p className="text-xs font-semibold uppercase text-text-tertiary">Inventory Status Report</p>
          <p className="text-sm text-text-secondary">Combined status of all packs with filters.</p>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <select
            aria-label="Inventory status"
            value={status}
            onChange={(e) => setStatus(e.target.value as PackStatus)}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm"
          >
            {["ALL", "BACK_STOCK", "ACTIVE", "RETURNED", "SOLD_OUT", "COMPLETED"].map((value) => (
              <option key={value} value={value}>
                {value.replaceAll("_", " ")}
              </option>
            ))}
          </select>
          <input
            aria-label="Search inventory"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search game, pack, serial..."
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm"
          />
          <Button variant="outline" onClick={() => window.open(`/api/reports/export?type=inventory&from=${dateRange.from}&to=${dateRange.to}`, "_blank")}>
            Export CSV
          </Button>
          <ReportActions document={reportDocument} disabled={loading || !!error} />
        </div>
      </div>

      {error && <p className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mb-3 flex flex-wrap gap-2 text-xs text-text-secondary">
        {Object.entries(counts).map(([key, value]) => (
          <span key={key} className="rounded-full bg-surface-soft px-2 py-1">
            {key.replaceAll("_", " ")}: {value}
          </span>
        ))}
        <span className="rounded-full bg-surface-soft px-2 py-1 font-semibold text-text">
          Filtered Retail Value: ${totalRetail.toFixed(2)}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-tertiary">
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">Game</th>
              <th className="py-2 pr-3">Display #</th>
              <th className="py-2 pr-3">Pack #</th>
              <th className="py-2 pr-3">Serial</th>
              <th className="py-2 pr-3 text-right">Qty</th>
              <th className="py-2 pr-3 text-right">Retail Value</th>
              <th className="py-2 pr-3">Reason</th>
            </tr>
          </thead>
          <tbody>
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={8} className="py-8 text-center text-text-secondary">
                  No packs found for this filter.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-border">
                <td className="py-2 pr-3">{row.status.replaceAll("_", " ")}</td>
                <td className="py-2 pr-3">
                  {row.game.name}
                  <span className="ml-1 text-xs text-text-tertiary">#{row.gameNumber ?? "—"}</span>
                </td>
                <td className="py-2 pr-3">{row.slot?.slotNumber ?? "—"}</td>
                <td className="py-2 pr-3">{row.packNumber ?? "—"}</td>
                <td className="py-2 pr-3 text-xs">{row.serialNumber}</td>
                <td className="py-2 pr-3 text-right">{row.ticketQuantity ?? 0}</td>
                <td className="py-2 pr-3 text-right">${Number(row.retailValue).toFixed(2)}</td>
                <td className="py-2 pr-3">{row.activeRemovalReason ?? row.removalReason ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
