"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Clock3, RefreshCw } from "lucide-react";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";

interface OverrideNotification {
  id: string | number;
  storeName: string;
  detail: string;
  performedByName: string | null;
  createdAt: string;
}

export function ShipmentOverrideNotifications() {
  const [notifications, setNotifications] = useState<OverrideNotification[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      setLoading(true);
      const response = await fetch("/api/notifications/overrides", { cache: "no-store" });
      const data = await response.json();
      if (response.ok) setNotifications(data.notifications ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  return (
    <Panel className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">Owner notifications</p>
          <h3 className="mt-1 text-base font-semibold text-text">Shipment Overrides</h3>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
        </Button>
      </div>
      {loading ? (
        <p className="text-sm text-text-secondary">Loading override notifications...</p>
      ) : notifications.length === 0 ? (
        <p className="rounded-md border border-border bg-surface-soft px-3 py-3 text-sm text-text-secondary">No shipment overrides recorded.</p>
      ) : (
        <div className="space-y-2">
          {notifications.map((notification) => (
            <div key={String(notification.id)} className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800"><AlertTriangle size={13} /> {notification.storeName}</span>
                <span className="inline-flex items-center gap-1 text-[11px] text-text-tertiary"><Clock3 size={12} /> {new Date(notification.createdAt).toLocaleString()}</span>
              </div>
              <p className="mt-1 text-sm text-text">{notification.detail}</p>
              <p className="mt-1 text-xs text-text-tertiary">Approved by {notification.performedByName ?? "Unknown"}</p>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
