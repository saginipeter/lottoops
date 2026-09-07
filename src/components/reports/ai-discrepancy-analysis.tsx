"use client";

import { useEffect, useState } from "react";
import { BrainCircuit, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";

interface Analysis { risk: string; findings: Array<{ type: string; detail: string }>; counts: { auditVariances: number; sequenceLocks: number; repeatActors: number } }

export function AiDiscrepancyAnalysis() {
  const [analysis, setAnalysis] = useState<Analysis | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  async function load() { setLoading(true); setError(""); try { const response = await fetch("/api/reports/ai-discrepancy-analysis", { cache: "no-store" }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Unable to analyze discrepancies."); setAnalysis(data); } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to analyze discrepancies."); } finally { setLoading(false); } }
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, []);
  const color = analysis?.risk === "HIGH" ? "text-red-700 bg-red-50 border-red-200" : analysis?.risk === "MEDIUM" ? "text-amber-800 bg-amber-50 border-amber-200" : "text-emerald-700 bg-emerald-50 border-emerald-200";
  return <Panel className="p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div className="flex items-start gap-2"><BrainCircuit size={18} className="mt-0.5 text-accent" /><div><p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">Premium analysis</p><h2 className="text-base font-semibold text-text">AI Discrepancy Analysis</h2><p className="mt-1 text-sm text-text-secondary">Highlights repeat patterns and current ticket-control risk.</p></div></div><Button size="sm" variant="outline" onClick={() => { void load(); }} disabled={loading}><RefreshCw size={13} className={loading ? "animate-spin" : ""} />Refresh</Button></div>{loading ? <div className="mt-4 flex items-center gap-2 text-sm text-text-secondary"><Loader2 size={15} className="animate-spin" />Analyzing discrepancies...</div> : error ? <p className="mt-4 text-sm text-text-secondary">{error}</p> : analysis ? <><div className={`mt-4 rounded-md border px-3 py-2 text-sm font-semibold ${color}`}>Risk level: {analysis.risk}</div><div className="mt-4 space-y-2">{analysis.findings.length ? analysis.findings.map((finding) => <div key={`${finding.type}-${finding.detail}`} className="rounded-md border border-border bg-surface-soft p-3"><p className="text-xs font-semibold uppercase text-text-tertiary">{finding.type.replaceAll("_", " ")}</p><p className="mt-1 text-sm text-text">{finding.detail}</p></div>) : <p className="text-sm text-emerald-700">No repeat discrepancy patterns detected.</p>}</div></> : null}</Panel>;
}
