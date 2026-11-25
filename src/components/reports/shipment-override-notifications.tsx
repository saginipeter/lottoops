"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Clock3, RefreshCw } from "lucide-react";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { ReportActions } from "./report-actions";
import { formatReportTimestamp } from "@/lib/report-timestamp";
import { readableReportText } from "@/lib/report-readable-text";
import { buildShipmentOverridesDocument } from "@/lib/workspace-detail-report-documents";
import type { ReportDateRangeValue } from "@/components/reports/report-date-filter";

interface OverrideNotification {
  id: string | number;
  storeName: string;
  detail: string;
  performedByName: string | null;
  createdAt: string;
  expectedPackQuantity: number | null;
  recordedPackQuantity: number | null;
}

interface TicketQuantityOverride {
  id: string;
  storeName: string;
  serialNumber: string;
  packNumber: string | null;
  gameName: string;
  gameNumber: string;
  expectedTicketQuantity: number;
  recordedTicketQuantity: number;
  reason: string;
  status: string;
  actorName: string | null;
  createdAt: string;
}

export function ShipmentOverrideNotifications({ dateRange }: { dateRange: ReportDateRangeValue }) {
  const [notifications, setNotifications] = useState<OverrideNotification[]>([]);
  const [ticketQuantityOverrides, setTicketQuantityOverrides] = useState<TicketQuantityOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const response = await fetch(`/api/notifications/overrides?from=${dateRange.from}&to=${dateRange.to}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load shipment overrides.");
      setNotifications(data.notifications ?? []);
      setTicketQuantityOverrides(data.ticketQuantityOverrides ?? []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load shipment overrides.");
    } finally {
      setLoading(false);
    }
  }, [dateRange.from, dateRange.to]);

  useEffect(() => { void load(); }, [load]);

  return (
    <Panel className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">Owner notifications</p>
          <h3 className="mt-1 text-base font-semibold text-text">Shipment Overrides</h3>
        </div>
        <ReportActions document={buildShipmentOverridesDocument(notifications, ticketQuantityOverrides)} disabled={loading || !!error} />
        {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
        </Button>
      </div>
      {loading ? (
        <p className="text-sm text-text-secondary">Loading override notifications...</p>
      ) : notifications.length === 0 && ticketQuantityOverrides.length === 0 ? (
        <p className="rounded-md border border-border bg-surface-soft px-3 py-3 text-sm text-text-secondary">No shipment overrides recorded.</p>
      ) : (
        <div className="space-y-5">
          {notifications.length > 0 && <div className="space-y-2">
          <h4 className="text-sm font-semibold text-text">Shipment pack-count approvals</h4>
          {notifications.map((notification) => (
            <div key={String(notification.id)} className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800"><AlertTriangle size={13} /> {notification.storeName}</span>
                <span className="inline-flex items-center gap-1 text-[11px] text-text-tertiary"><Clock3 size={12} /> {formatReportTimestamp(notification.createdAt)}</span>
              </div>
              <p className="mt-1 text-sm text-text">{readableReportText(notification.detail)}</p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <p className="rounded bg-white/70 px-2 py-1.5"><span className="font-semibold">Expected Quantity:</span> {notification.expectedPackQuantity ?? "Not recorded"}{notification.expectedPackQuantity == null ? "" : " packs"}</p>
                <p className="rounded bg-white/70 px-2 py-1.5"><span className="font-semibold">Recorded Quantity:</span> {notification.recordedPackQuantity ?? "Not recorded"}{notification.recordedPackQuantity == null ? "" : " packs"}</p>
              </div>
              <p className="mt-1 text-xs text-text-tertiary">Approved by {notification.performedByName ?? "Unknown"}</p>
            </div>
          ))}
          </div>}
          {ticketQuantityOverrides.length > 0 && <div>
            <h4 className="mb-2 text-sm font-semibold text-text">Per-pack ticket quantity overrides</h4>
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full min-w-[760px] text-left text-xs">
                <thead className="bg-surface-soft text-text-secondary"><tr>
                  <th className="p-2 font-semibold">Game/Pack</th>
                  <th className="p-2 text-right font-semibold">Expected Tickets</th>
                  <th className="p-2 text-right font-semibold">Recorded Tickets</th>
                  <th className="p-2 font-semibold">Reason</th>
                  <th className="p-2 font-semibold">Action/Status</th>
                </tr></thead>
                <tbody>{ticketQuantityOverrides.map((override) => (
                  <tr key={override.id} className="border-t border-border align-top">
                    <td className="p-2"><span className="font-semibold">{override.gameName} · Game {override.gameNumber}</span><span className="mt-0.5 block break-all font-mono text-text-tertiary">Pack {override.packNumber ?? override.serialNumber}{override.packNumber ? ` · ${override.serialNumber}` : ""}</span><span className="block text-text-tertiary">{override.storeName}</span></td>
                    <td className="p-2 text-right tabular-nums">{override.expectedTicketQuantity}</td>
                    <td className="p-2 text-right tabular-nums">{override.recordedTicketQuantity}</td>
                    <td className="max-w-sm whitespace-pre-wrap p-2">{override.reason}</td>
                    <td className="p-2">{override.status.replaceAll("_", " ")}<span className="mt-0.5 block text-text-tertiary">{override.actorName ?? "Unknown"} · {formatReportTimestamp(override.createdAt)}</span></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>}
        </div>
      )}
    </Panel>
  );
}
