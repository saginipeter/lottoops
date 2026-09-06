"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";

interface Ticket {
  id: string;
  subject: string;
  description: string;
  priority: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
}

const HELP_ARTICLES = [
  { title: "Phone camera scanning", category: "Scanner", body: "Use the Scan with Camera button on Live Scan, allow camera access, and keep the barcode inside the targeting frame. Manual entry remains available if camera access is unavailable." },
  { title: "Receiving an invoice", category: "Receiving", body: "Enter the invoice details, scan each pack, review the shipment, then confirm it into Back Stock or an assigned display." },
  { title: "Resuming an unfinished invoice", category: "Receiving", body: "Return to Receive Shipment on the same device and browser. The saved shipment draft resumes at its last step." },
  { title: "Opening and closing a shift", category: "Shifts", body: "Open the shift before sales activity. Complete the beginning and ending physical audits before closing so ticket differences can be attributed to the correct employee." },
  { title: "Passwords and staff accounts", category: "Accounts", body: "Each staff account needs its own unique password. Owners and Managers can create accounts from Settings and reset passwords from the Staff page." },
];

export function SupportTicketsPanel() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("NORMAL");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [helpSearch, setHelpSearch] = useState("");

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/support-tickets", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load support tickets.");
      setTickets(data.tickets ?? []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load support tickets.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/support-tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, description, priority }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to create support ticket.");
      setSubject("");
      setDescription("");
      setPriority("NORMAL");
      setMessage("Support ticket submitted.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to create support ticket.");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(ticket: Ticket, status: string) {
    const response = await fetch("/api/support-tickets", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: ticket.id, status }),
    });
    if (response.ok) await load();
    else setError((await response.json()).error || "Unable to update ticket.");
  }

  const visibleArticles = HELP_ARTICLES.filter((article) =>
    `${article.title} ${article.category} ${article.body}`.toLowerCase().includes(helpSearch.toLowerCase().trim())
  );

  return (
    <div className="space-y-4">
      <Panel className="p-4 sm:p-5">
        <h2 className="text-base font-semibold text-text">Help Center</h2>
        <p className="mt-1 text-sm text-text-secondary">Quick answers for common LottoOps setup and daily-use questions.</p>
        <input value={helpSearch} onChange={(event) => setHelpSearch(event.target.value)} placeholder="Search help articles" className="mt-4 w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {visibleArticles.map((article) => (
            <details key={article.title} className="rounded-md border border-border bg-surface-soft p-3">
              <summary className="cursor-pointer text-sm font-semibold text-text">{article.title}<span className="ml-2 text-[10px] uppercase tracking-wide text-text-tertiary">{article.category}</span></summary>
              <p className="mt-2 text-sm leading-6 text-text-secondary">{article.body}</p>
            </details>
          ))}
          {visibleArticles.length === 0 && <p className="text-sm text-text-secondary">No help articles match your search.</p>}
        </div>
      </Panel>
      <Panel className="p-4 sm:p-5">
        <h2 className="text-base font-semibold text-text">Contact LottoOps Support</h2>
        <p className="mt-1 text-sm text-text-secondary">Submit setup, scanner, account, or software-use questions for follow-up.</p>
        <form onSubmit={submit} className="mt-4 grid gap-3">
          <input required value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="What do you need help with?" className="rounded-md border border-border bg-surface px-3 py-2.5 text-sm" />
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <textarea required value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe the issue and what you were trying to do." className="min-h-28 rounded-md border border-border bg-surface px-3 py-2.5 text-sm" />
            <select value={priority} onChange={(event) => setPriority(event.target.value)} className="h-10 rounded-md border border-border bg-surface px-3 text-sm sm:self-start">
              <option value="NORMAL">Normal</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>
          <div className="flex justify-end"><Button type="submit" disabled={saving}>{saving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}{saving ? "Submitting..." : "Submit Ticket"}</Button></div>
        </form>
        {message && <p className="mt-3 flex items-center gap-2 text-sm text-emerald-700"><CheckCircle2 size={15} />{message}</p>}
        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      </Panel>

      <Panel className="p-4 sm:p-5">
        <div className="flex items-center justify-between"><div><h2 className="text-base font-semibold text-text">Support Queue</h2><p className="mt-1 text-sm text-text-secondary">Track your store&apos;s open support requests.</p></div>{loading && <Loader2 size={16} className="animate-spin text-text-tertiary" />}</div>
        <div className="mt-4 space-y-3">
          {!loading && tickets.length === 0 && <p className="text-sm text-text-secondary">No support tickets yet.</p>}
          {tickets.map((ticket) => <div key={ticket.id} className="rounded-md border border-border p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-medium text-text">{ticket.subject}</p><p className="mt-1 whitespace-pre-wrap text-sm text-text-secondary">{ticket.description}</p></div><span className="rounded-full bg-surface-soft px-2 py-1 text-[11px] font-semibold text-text-secondary">{ticket.priority} · {ticket.status}</span></div><div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-text-tertiary"><span>{new Date(ticket.createdAt).toLocaleString()}</span><select value={ticket.status} onChange={(event) => { void updateStatus(ticket, event.target.value); }} className="rounded border border-border bg-surface px-2 py-1"><option value="OPEN">Open</option><option value="IN_PROGRESS">In progress</option><option value="RESOLVED">Resolved</option><option value="CLOSED">Closed</option></select></div></div>)}
        </div>
      </Panel>
    </div>
  );
}
