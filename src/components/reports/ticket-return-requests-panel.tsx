"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock3, PackageCheck, RefreshCw, XCircle } from "lucide-react";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";

interface ReturnRequest {
  id: string;
  storeId: string;
  shiftId: string;
  packId: string;
  ticketBarcode: string | null;
  reason: string | null;
  requestedByName: string | null;
  createdAt: string;
  serialNumber: string;
  gameName: string;
  gameNumber: string;
}

function formatRelativeTime(createdAt: string): string {
  const timestamp = new Date(createdAt).getTime();
  const diffMs = Date.now() - timestamp;

  if (!Number.isFinite(diffMs) || diffMs < 0) {
    return new Date(createdAt).toLocaleString();
  }

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < minute) return "just now";
  if (diffMs < hour) return `${Math.floor(diffMs / minute)}m ago`;
  if (diffMs < day) return `${Math.floor(diffMs / hour)}h ago`;
  return `${Math.floor(diffMs / day)}d ago`;
}

export function TicketReturnRequestsPanel({
  title = "Ticket Return Requests",
}: {
  title?: string;
}) {
  const [requests, setRequests] = useState<ReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actingId, setActingId] = useState<string | null>(null);

  const loadRequests = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) setLoading(true);
    if (!silent) setError("");
    try {
      const res = await fetch("/api/tickets/return-requests", { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError((data && typeof data.error === "string" && data.error) || "Unable to load return requests.");
        return;
      }
      setRequests(Array.isArray(data?.requests) ? data.requests : []);
    } catch {
      setError("Unable to load return requests.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadRequests({ silent: true });
    }, 4000);
    return () => window.clearInterval(interval);
  }, [loadRequests]);

  async function respond(requestId: string, action: "approve" | "deny") {
    try {
      setActingId(requestId);
      setError("");
      const res = await fetch(`/api/tickets/return-requests/${requestId}/${action}`, {
        method: "POST",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError((data && typeof data.error === "string" && data.error) || `Unable to ${action} return request.`);
        return;
      }
      setRequests((prev) => prev.filter((request) => request.id !== requestId));
    } catch {
      setError(`Unable to ${action} return request.`);
    } finally {
      setActingId(null);
    }
  }

  return (
    <Panel className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">Alerts</p>
          <div className="mt-1 flex items-center gap-2">
            <h3 className="text-base font-semibold text-text">{title}</h3>
            {!loading && requests.length > 0 && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                {requests.length} pending
              </span>
            )}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => loadRequests()} disabled={loading}>
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
        <p className="text-sm text-text-secondary">Loading return requests...</p>
      ) : requests.length === 0 ? (
        <div className="rounded-md border border-border bg-surface-soft px-3 py-3 text-sm text-text-secondary">
          No pending ticket return requests.
        </div>
      ) : (
        <div className="space-y-2.5">
          {requests.map((request) => (
            <div key={request.id} className="rounded-lg border border-amber-200 bg-gradient-to-r from-amber-50 to-surface px-3.5 py-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                  Customer rejected ticket
                </div>
                <div className="inline-flex items-center gap-1 text-[11px] text-text-tertiary">
                  <Clock3 size={12} />
                  {formatRelativeTime(request.createdAt)}
                </div>
              </div>

              <p className="text-sm font-semibold text-text break-words">
                {request.gameName} (Game {request.gameNumber}) · Pack {request.serialNumber}
              </p>
              {request.reason && (
                <p className="mt-1 text-sm text-text break-words">Reason: {request.reason}</p>
              )}
              <p className="mt-1 text-xs text-text-tertiary">
                Requested by {request.requestedByName ?? "Unknown"}
              </p>

              <div className="mt-2 flex gap-2">
                <Button
                  size="sm"
                  onClick={() => respond(request.id, "approve")}
                  disabled={actingId === request.id}
                  className="h-8"
                >
                  <PackageCheck size={14} />
                  {actingId === request.id ? "Approving..." : "Approve Return"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => respond(request.id, "deny")}
                  disabled={actingId === request.id}
                  className="h-8"
                >
                  <XCircle size={14} />
                  Deny
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
