"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ChevronDown, Clock3, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";

interface OperationalAlert { id: string; type: string; severity: string; title: string; detail: string; createdAt: string; entityId: string; }
type AlertCategory = "ALL" | "LOW_STOCK" | "SHIPMENT" | "AUDIT" | "SYSTEM";

const alertCategories: Array<{ id: AlertCategory; label: string }> = [
  { id: "ALL", label: "All alerts" },
  { id: "LOW_STOCK", label: "Low stock" },
  { id: "SHIPMENT", label: "Receiving & overrides" },
  { id: "AUDIT", label: "Audits" },
  { id: "SYSTEM", label: "System & devices" },
];

function getAlertCategory(type: string): AlertCategory {
  if (type === "LOW_TICKETS") return "LOW_STOCK";
  if (type === "STALE_RECEIVING" || type === "SHIPMENT_OVERRIDE") return "SHIPMENT";
  if (type === "INCOMPLETE_AUDIT" || type === "INVENTORY_AUDIT_VARIANCE") return "AUDIT";
  return "SYSTEM";
}

const severityStyle: Record<string, string> = { URGENT: "border-red-300 bg-red-50 text-red-800", HIGH: "border-orange-300 bg-orange-50 text-orange-800", MEDIUM: "border-amber-300 bg-amber-50 text-amber-800" };

export function OperationalAlertsPanel() {
  const [alerts, setAlerts] = useState<OperationalAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(true);
  const [category, setCategory] = useState<AlertCategory>("ALL");

  async function load() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/alerts/operational", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load operational alerts.");
      setAlerts(data.alerts ?? []);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to load operational alerts."); }
    finally { setLoading(false); }
  }

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, []);

  const filteredAlerts = category === "ALL" ? alerts : alerts.filter((alert) => getAlertCategory(alert.type) === category);

  return <Panel className="overflow-hidden p-0">
    <div className="flex flex-wrap items-start justify-between gap-3 p-4 sm:p-5">
      <button type="button" onClick={() => setExpanded((value) => !value)} className="flex min-w-0 items-start gap-2 text-left">
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-orange-600" />
        <span><span className="block text-base font-semibold text-text">Operational Alerts</span><span className="mt-1 block text-sm text-text-secondary">Automatic checks for low tickets, audits, receiving, and terminal health.</span></span>
        <ChevronDown size={16} className={`mt-1 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="operational-alert-category">Filter alert category</label>
        <select id="operational-alert-category" value={category} onChange={(event) => setCategory(event.target.value as AlertCategory)} className="min-h-9 border border-border bg-surface px-2 text-xs font-semibold text-text">
          {alertCategories.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select>
        <Button size="sm" variant="outline" onClick={() => { void load(); }} disabled={loading}><RefreshCw size={13} className={loading ? "animate-spin" : ""} />Refresh</Button>
      </div>
    </div>
    {expanded && <div className="border-t border-border px-4 pb-4 sm:px-5">
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      {loading ? <div className="mt-4 flex items-center gap-2 text-sm text-text-secondary"><Loader2 size={15} className="animate-spin" />Checking store conditions...</div>
        : alerts.length === 0 ? <p className="mt-4 text-sm text-emerald-700">No operational alerts detected.</p>
          : filteredAlerts.length === 0 ? <p className="mt-4 text-sm text-text-secondary">No alerts in this category.</p>
            : <div className="mt-4 space-y-2">{filteredAlerts.map((alert) => <div key={alert.id} className={`rounded-md border px-3 py-3 ${severityStyle[alert.severity] ?? "border-border bg-surface-soft text-text"}`}><div className="flex items-start gap-2"><Clock3 size={15} className="mt-0.5 shrink-0" /><div><p className="text-sm font-semibold">{alert.title} <span className="ml-1 text-[10px] uppercase">{alert.severity}</span></p><p className="mt-1 text-xs">{alert.detail}</p></div></div></div>)}</div>}
    </div>}
  </Panel>;
}
