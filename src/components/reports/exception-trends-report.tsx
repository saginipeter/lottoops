"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";

interface Day { date: string; auditVariances: number; sequenceLocks: number; resolved: number }
interface Data { totals: Day[]; summary: { auditVariances: number; openSequenceLocks: number; resolved: number } }

export function ExceptionTrendsReport() {
  const [data, setData] = useState<Data | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  async function load() { setLoading(true); setError(""); try { const response = await fetch("/api/reports/exception-trends", { cache: "no-store" }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "Unable to load exception trends."); setData(payload); } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to load exception trends."); } finally { setLoading(false); } }
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, []);
  const max = Math.max(...(data?.totals.map((day) => day.auditVariances + day.sequenceLocks) ?? [1]), 1);
  return <Panel className="p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div className="flex items-start gap-2"><AlertTriangle size={18} className="mt-0.5 text-orange-600" /><div><p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">Exception analytics</p><h2 className="text-base font-semibold text-text">Exception Trends</h2><p className="mt-1 text-sm text-text-secondary">Audit mismatches, sequence locks, and resolutions over the last 30 days.</p></div></div><Button size="sm" variant="outline" onClick={() => { void load(); }} disabled={loading}><RefreshCw size={13} className={loading ? "animate-spin" : ""} />Refresh</Button></div>{error && <p className="mt-3 text-sm text-red-700">{error}</p>}{loading ? <div className="mt-4 flex items-center gap-2 text-sm text-text-secondary"><Loader2 size={15} className="animate-spin" />Loading trends...</div> : data ? <><div className="mt-4 grid grid-cols-3 gap-3"><div><p className="text-xs text-text-secondary">Audit variances</p><p className="mt-1 text-xl font-bold text-red-700">{data.summary.auditVariances}</p></div><div><p className="text-xs text-text-secondary">Open locks</p><p className="mt-1 text-xl font-bold text-orange-700">{data.summary.openSequenceLocks}</p></div><div><p className="text-xs text-text-secondary">Resolved</p><p className="mt-1 text-xl font-bold text-emerald-700">{data.summary.resolved}</p></div></div><div className="mt-5 flex h-28 items-end gap-1 overflow-x-auto">{data.totals.map((day) => { const count = day.auditVariances + day.sequenceLocks; return <div key={day.date} className="flex h-full min-w-5 flex-1 flex-col justify-end gap-1"><div className="rounded-t bg-red-500" style={{ height: `${Math.max((count / max) * 100, count ? 5 : 0)}%` }} title={`${day.date}: ${count} exception(s)`} /><span className="text-center text-[9px] text-text-tertiary">{day.date.slice(5)}</span></div>; })}</div></> : null}</Panel>;
}
