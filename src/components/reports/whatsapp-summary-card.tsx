"use client";

import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { ReportActions } from "@/components/reports/report-actions";

export function WhatsAppSummaryCard() {
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState("");
  async function send() {
    setSending(true); setMessage(""); setError(""); setSummary(null);
    try {
      const response = await fetch("/api/reports/whatsapp-summary", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to send summary.");
      setSummary(typeof data.message === "string" ? data.message : null);
      setMessage("Daily summary sent to WhatsApp.");
    } catch (reason) {
      const detail = reason instanceof Error ? reason.message : "Unable to send summary.";
      setError(detail); setMessage(detail);
    } finally { setSending(false); }
  }
  const [heading, ...metrics] = summary?.split("\n") ?? [];
  return <Panel className="p-4 sm:p-5">
    <div className="mb-3">
      <ReportActions disabled={sending || !!error || !summary} document={{
        title: "WhatsApp Daily Summary",
        subtitle: heading,
        metadata: [{ label: "Delivery", value: summary ? "Sent to configured operations contact" : null }],
        sections: [{
          title: "Sent summary",
          columns: ["Metric", "Value"],
          rows: metrics.map((metric) => {
            const separator = metric.indexOf(":");
            return separator < 0 ? ["Summary", metric] : [metric.slice(0, separator), metric.slice(separator + 1).trim()];
          }),
        }],
      }} />
    </div>
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">Premium notification</p><h2 className="text-base font-semibold text-text">WhatsApp Daily Summary</h2><p className="mt-1 text-sm text-text-secondary">Send today&apos;s shifts, ticket sales, audit variances, and sequence locks to the configured operations contact.</p></div><Button onClick={() => { void send(); }} disabled={sending}>{sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}{sending ? "Sending..." : "Send Summary"}</Button></div>{message && <p className="mt-3 text-sm text-text-secondary">{message}</p>}</Panel>;
}
