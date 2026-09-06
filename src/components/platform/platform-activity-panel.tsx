"use client";

import { useEffect, useState } from "react";
import { Activity, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";

interface ActivityRow { id: string; storeName: string | null; action: string; entityType: string; entityId: string | null; detail: string; performedByName: string | null; createdAt: string; }

export function PlatformActivityPanel() {
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  async function load() {
    setLoading(true); setError("");
    try { const response = await fetch("/api/platform/activity", { cache: "no-store" }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Unable to load platform activity."); setActivities(data.activities ?? []); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to load platform activity."); }
    finally { setLoading(false); }
  }
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, []);
  return <Panel className="p-5"><div className="flex items-start justify-between gap-3"><div className="flex items-start gap-2"><Activity size={18} className="mt-0.5 text-accent" /><div><h3 className="text-base font-semibold text-text">Global Activity Audit Trail</h3><p className="mt-1 text-sm text-text-secondary">Recent critical actions across customer stores.</p></div></div><Button size="sm" variant="outline" onClick={() => { void load(); }} disabled={loading}><RefreshCw size={13} className={loading ? "animate-spin" : ""} />Refresh</Button></div>{error && <p className="mt-3 text-sm text-red-700">{error}</p>}{loading ? <div className="mt-4 flex items-center gap-2 text-sm text-text-secondary"><Loader2 size={15} className="animate-spin" />Loading activity...</div> : activities.length === 0 ? <p className="mt-4 text-sm text-text-secondary">No activity has been recorded.</p> : <div className="mt-4 max-h-96 space-y-2 overflow-y-auto">{activities.map((activity) => <div key={activity.id} className="rounded-md border border-border p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">{activity.action.replaceAll("_", " ")}</p><p className="text-xs text-text-tertiary">{new Date(activity.createdAt).toLocaleString()}</p></div><p className="mt-1 text-sm text-text">{activity.detail}</p><p className="mt-1 text-xs text-text-secondary">{activity.storeName ?? "Unknown store"} · {activity.performedByName ?? "Unknown user"} · {activity.entityType}</p></div>)}</div>}</Panel>;
}
