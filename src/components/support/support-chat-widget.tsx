"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Loader2, MessageCircle, RefreshCw, Send, Tv } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getTvTarget, launchTvWindow, type TvStore } from "@/components/home/tv-display-launcher";

type SupportMessage = {
  id: string;
  subject: string;
  description: string;
  priority: string;
  status: string;
  createdAt: string;
};

export function SupportChatWidget({
  role,
  currentStoreId,
  stores,
}: {
  role: string;
  currentStoreId: string;
  stores: TvStore[];
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [topic, setTopic] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [openingTv, setOpeningTv] = useState(false);
  const [error, setError] = useState("");
  const [tvError, setTvError] = useState("");
  const [notice, setNotice] = useState("");
  const tvTarget = useMemo(() => getTvTarget(stores, currentStoreId), [stores, currentStoreId]);
  const canUseChat = role === "OWNER" || role === "MANAGER";
  const canOpenTv = canUseChat || role === "EMPLOYEE" || role === "SHIFT_LEAD";
  const showTvShortcut = pathname !== "/tv-display" && (
    role === "EMPLOYEE" || role === "SHIFT_LEAD" || (pathname !== "/" && pathname !== "/owner")
  );

  const loadMessages = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/support-tickets", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load support requests.");
      setMessages(Array.isArray(data.tickets) ? data.tickets : []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load support requests.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => { void loadMessages(); }, 0);
    return () => window.clearTimeout(timer);
  }, [open, loadMessages]);

  async function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanMessage = message.trim();
    const cleanTopic = topic.trim() || "Support request";
    if (!cleanMessage || sending) return;

    setSending(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/support-tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: cleanTopic, description: cleanMessage, priority: "NORMAL" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to send your support message.");
      if (data.ticket) setMessages((current) => [data.ticket, ...current]);
      setTopic("");
      setMessage("");
      setNotice("Your message was sent to the store support queue.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to send your support message.");
    } finally {
      setSending(false);
    }
  }

  async function openTvDisplay() {
    if (!tvTarget || openingTv) return;
    setOpeningTv(true);
    setTvError("");
    try {
      await launchTvWindow(tvTarget.id, () => window.open("about:blank", "_blank"));
    } catch (reason) {
      setTvError(reason instanceof Error ? reason.message : "Unable to open the TV Display Board.");
    } finally {
      setOpeningTv(false);
    }
  }

  if (!canOpenTv || pathname === "/tv-display") return null;

  return (
    <>
      <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+1rem)] right-3 z-40 flex items-center gap-2 sm:right-5">
        {showTvShortcut && <Button
          type="button"
          variant="outline"
          aria-label="Open TV Display Board"
          title="Open TV Display Board"
          disabled={!tvTarget || openingTv}
          onClick={() => { void openTvDisplay(); }}
          className="min-h-12 gap-2 border-slate-300 bg-white px-3 text-slate-800 shadow-lg hover:bg-slate-50"
        >
          {openingTv ? <Loader2 size={17} className="animate-spin" /> : <Tv size={17} />}
          <span>Open TV</span>
        </Button>}
        {canUseChat && <Button
          type="button"
          aria-label="Open support chat"
          onClick={() => { setOpen(true); setNotice(""); }}
          className="min-h-12 gap-2 rounded-full bg-[#087da8] px-4 text-white shadow-lg hover:bg-[#066b91]"
        >
          <MessageCircle size={18} />
          <span>Support Chat</span>
        </Button>}
      </div>
      {showTvShortcut && tvError && <p role="alert" className="fixed bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] right-3 z-40 max-w-[min(24rem,calc(100vw-1.5rem))] rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-medium text-red-700 shadow-lg sm:right-5">{tvError}</p>}

      {canUseChat && <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="!bottom-[calc(env(safe-area-inset-bottom)+5rem)] !left-3 !right-3 !top-auto flex h-[min(680px,calc(100dvh-7rem))] !w-auto !max-w-none !translate-x-0 !translate-y-0 flex-col gap-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl sm:!bottom-20 sm:!left-auto sm:!right-5 sm:!w-[420px] sm:!max-w-[calc(100vw-2.5rem)]">
          <DialogHeader className="shrink-0 border-b border-slate-200 bg-[#10203d] px-5 py-4 pr-14 text-white">
            <DialogTitle className="text-base font-bold text-white">LottoOps Support</DialogTitle>
            <DialogDescription className="text-xs leading-5 text-white/75">
              Send a technical issue or question. Messages are saved in your store&apos;s support queue for follow-up.
            </DialogDescription>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2">
              <p className="text-xs font-semibold text-slate-600">Recent support requests</p>
              <button type="button" onClick={() => { void loadMessages(); }} disabled={loading} aria-label="Refresh support requests" className="rounded-md p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50">
                {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-50 px-4 py-3" aria-live="polite">
              {loading && messages.length === 0 && <p className="py-5 text-center text-sm text-slate-500">Loading support history…</p>}
              {!loading && messages.length === 0 && <p className="py-5 text-center text-sm text-slate-500">No support messages yet. Send a note below to start a request.</p>}
              {messages.map((item) => (
                <article key={item.id} className="ml-auto max-w-[92%] rounded-2xl rounded-br-sm border border-sky-100 bg-sky-50 px-3.5 py-3 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-900">{item.subject}</h3>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-600">{item.status.replaceAll("_", " ")}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-5 text-slate-700">{item.description}</p>
                  <p className="mt-2 text-right text-[10px] text-slate-500">{new Date(item.createdAt).toLocaleString()}</p>
                </article>
              ))}
            </div>

            <form onSubmit={(event) => { void sendMessage(event); }} className="shrink-0 space-y-2 border-t border-slate-200 bg-white p-3">
              <label className="sr-only" htmlFor="support-chat-topic">Topic (optional)</label>
              <input
                id="support-chat-topic"
                maxLength={160}
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                placeholder="Topic (optional — e.g. scanner issue)"
                className="min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
              />
              <div className="flex items-end gap-2">
                <label className="sr-only" htmlFor="support-chat-message">Your message</label>
                <textarea
                  id="support-chat-message"
                  required
                  maxLength={5000}
                  rows={3}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      event.currentTarget.form?.requestSubmit();
                    }
                  }}
                  placeholder="Describe what happened and what you were trying to do…"
                  className="min-h-20 flex-1 resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
                />
                <Button type="submit" aria-label="Send support message" disabled={sending || !message.trim()} className="min-h-11 min-w-11 px-3">
                  {sending ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
                </Button>
              </div>
              {notice && <p role="status" className="text-xs font-medium text-emerald-700">{notice}</p>}
              {error && <p role="alert" className="text-xs font-medium text-red-700">{error}</p>}
            </form>
          </div>
        </DialogContent>
      </Dialog>}
    </>
  );
}
