"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";

interface TicketReport {
  id: number;
  storeId: string;
  storeName: string;
  detail: string;
  performedByName: string | null;
  createdAt: string;
}

export function TicketReportsPanel({
  title = "Employee Ticket Reports",
}: {
  title?: string;
}) {
  const [reports, setReports] = useState<TicketReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/tickets/reports", { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError((data && typeof data.error === "string" && data.error) || "Unable to load reports.");
        return;
      }

      setReports(Array.isArray(data?.reports) ? data.reports : []);
    } catch {
      setError("Unable to load reports.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  return (
    <Panel className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">Alerts</p>
          <h3 className="text-base font-semibold text-text">{title}</h3>
        </div>
        <Button variant="outline" size="sm" onClick={loadReports} disabled={loading}>
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="mb-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-text-secondary">Loading ticket reports...</p>
      ) : reports.length === 0 ? (
        <p className="text-sm text-text-secondary">No employee ticket reports yet.</p>
      ) : (
        <div className="space-y-2">
          {reports.slice(0, 8).map((report) => (
            <div key={report.id} className="rounded-md border border-border bg-surface-soft px-3 py-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text break-words">{report.detail}</p>
                  <p className="mt-1 text-xs text-text-tertiary">
                    By {report.performedByName ?? "Unknown"} · {report.storeName}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <AlertTriangle size={14} className="ml-auto text-amber-600" />
                  <p className="mt-1 text-[11px] text-text-tertiary">
                    {new Date(report.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
