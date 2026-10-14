"use client";

import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { ReportActions } from "./report-actions";
import { buildWhatsAppSummaryDocument } from "@/lib/workspace-detail-report-documents";

export function WhatsAppSummaryCard() {
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [summary, setSummary] = useState<{ text: string; sentAt: string } | null>(null);
  async function send() {
    setSending(true); setMessage(""); setSummary(null);
    try {
      const response = await fetch("/api/reports/whatsapp-summary", { method: "POST" });
      const data = await response.json();
      setMessage(response.ok ? "Daily summary sent to WhatsApp." : data.error || "Unable to send summary.");
      if (response.ok && typeof data.message === "string" && data.message.trim()) {
        setSummary({ text: data.message, sentAt: new Date().toISOString() });
      }
    } catch { setMessage("Unable to send summary."); } finally { setSending(false); }
  }
  return <Panel className="p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">Premium notification</p><h2 className="text-base font-semibold text-text">WhatsApp Daily Summary</h2><p className="mt-1 text-sm text-text-secondary">Send today&apos;s shifts, ticket sales, audit variances, and sequence locks to the configured operations contact.</p></div><Button onClick={() => { void send(); }} disabled={sending}>{sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}{sending ? "Sending..." : "Send Summary"}</Button></div>
    <ReportActions document={summary ? buildWhatsAppSummaryDocument(summary.text, summary.sentAt) : undefined} disabled={sending || !summary} />
    {message && <p className="mt-3 text-sm text-text-secondary">{message}</p>}</Panel>;
}
