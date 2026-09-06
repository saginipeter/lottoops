"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Clock3, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";

interface OperationalAlert { id: string; type: string; severity: string; title: string; detail: string; createdAt: string; entityId: string; }

const severityStyle: Record<string, string> = { URGENT: "border-red-300 bg-red-50 text-red-800", HIGH: "border-orange-300 bg-orange-50 text-orange-800", MEDIUM: "border-amber-300 bg-amber-50 text-amber-800" };

export function OperationalAlertsPanel() {
  const [alerts, setAlerts] = useState<OperationalAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  return <Panel className="p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div className="flex items-start gap-2"><AlertTriangle size={18} className="mt-0.5 text-orange-600" /><div><h2 className="text-base font-semibold text-text">Operational Alerts</h2><p className="mt-1 text-sm text-text-secondary">Automatic checks for low tickets, incomplete audits, and overdue receiving.</p></div></div><Button size="sm" variant="outline" onClick={() => { void load(); }} disabled={loading}><RefreshCw size={13} className={loading ? "animate-spin" : ""} />Refresh</Button></div>{error && <p className="mt-3 text-sm text-red-700">{error}</p>}{loading ? <div className="mt-4 flex items-center gap-2 text-sm text-text-secondary"><Loader2 size={15} className="animate-spin" />Checking store conditions...</div> : alerts.length === 0 ? <p className="mt-4 text-sm text-emerald-700">No operational alerts detected.</p> : <div className="mt-4 space-y-2">{alerts.map((alert) => <div key={alert.id} className={`rounded-md border px-3 py-3 ${severityStyle[alert.severity] ?? "border-border bg-surface-soft text-text"}`}><div className="flex items-start gap-2"><Clock3 size={15} className="mt-0.5 shrink-0" /><div><p className="text-sm font-semibold">{alert.title} <span className="ml-1 text-[10px] uppercase">{alert.severity}</span></p><p className="mt-1 text-xs">{alert.detail}</p></div></div></div>)}</div>}</Panel>;
}
