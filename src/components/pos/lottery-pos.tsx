"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Cloud, CloudOff, Keyboard, LockKeyhole, RefreshCw, ScanLine, Ticket, Wifi, X } from "lucide-react";
import { PhoneBarcodeScanner } from "@/components/inventory/phone-barcode-scanner";

interface PosProps { employeeName: string; storeName: string; terminalId: string; }
interface SaleResult { error?: string; code?: string; gameName?: string; gameNumber?: string; serialNumber?: string; ticketBarcode?: string; ticketPrice?: number | string | null; ticketsSold?: number; salesAmount?: number | string; nextTicketNumber?: number | null; slot?: { slotNumber?: string } | null; packStatus?: string; status?: string; }
interface QueueEntry { id: string; barcode: string; queuedAt: string; attempts: number; state?: "PENDING" | "CONFLICT"; conflictReason?: string; }

const QUEUE_PREFIX = "lottoops:pos-offline-queue:";

function queueKey(terminalId: string) { return `${QUEUE_PREFIX}${terminalId}`; }
function makeId() { return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `offline-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
function readQueue(terminalId: string): QueueEntry[] { try { const value = window.localStorage.getItem(queueKey(terminalId)); return value ? JSON.parse(value) as QueueEntry[] : []; } catch { return []; } }
function writeQueue(terminalId: string, queue: QueueEntry[]) { window.localStorage.setItem(queueKey(terminalId), JSON.stringify(queue)); }

export function LotteryPos({ employeeName, storeName, terminalId }: PosProps) {
  const [barcode, setBarcode] = useState("");
  const [result, setResult] = useState<SaleResult | null>(null);
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [online, setOnline] = useState(true);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [syncing, setSyncing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const replayingRef = useRef(false);
  const replayReasonRef = useRef("Server rejected the queued sale. Manager review is required before retrying.");

  const refreshQueue = useCallback(() => setQueue(readQueue(terminalId)), [terminalId]);
  const focusInput = useCallback(() => window.setTimeout(() => inputRef.current?.focus(), 80), []);

  useEffect(() => {
    setOnline(navigator.onLine);
    refreshQueue();
    const onOnline = () => { setOnline(true); refreshQueue(); };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline); window.addEventListener("offline", onOffline);
    return () => { window.removeEventListener("online", onOnline); window.removeEventListener("offline", onOffline); };
  }, [refreshQueue]);

  const enqueue = useCallback((value: string) => {
    const next = [...readQueue(terminalId), { id: makeId(), barcode: value, queuedAt: new Date().toISOString(), attempts: 0, state: "PENDING" as const }];
    writeQueue(terminalId, next); setQueue(next); setResult({ status: "queued", ticketBarcode: value }); setError(""); setShowSuccess(false);
  }, [terminalId]);

  const sendSale = useCallback(async (value: string, isReplay = false): Promise<"synced" | "retry" | "conflict"> => {
    try {
      const response = await fetch("/api/packs/check-serial", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ serialNumber: value, liveScan: true, terminalId }) });
      const data = (await response.json()) as SaleResult;
      if (response.ok) { if (!isReplay) { setResult(data); setShowSuccess(true); } return "synced"; }
      // If a response was lost after the server committed, the API's duplicate guard
      // means this replay is already accounted for and must leave the queue.
      if (isReplay && response.status === 409 && /already scanned|duplicate/i.test(data.error ?? "")) return "synced";
      const rejectionReason = data.error || "Unable to complete the ticket sale.";
      if (isReplay) replayReasonRef.current = rejectionReason;
      if (!isReplay) setError(rejectionReason);
      return isReplay && response.status >= 500 ? "retry" : isReplay ? "conflict" : "synced";
    } catch {
      if (!isReplay) enqueue(value);
      return "retry";
    }
  }, [enqueue, terminalId]);

  const syncQueue = useCallback(async () => {
    if (!navigator.onLine || replayingRef.current) return;
    const pending = readQueue(terminalId);
    if (pending.length === 0) { setQueue([]); return; }
    replayingRef.current = true; setSyncing(true);
    let remaining = [...pending];
    for (const entry of pending) {
      if (entry.state === "CONFLICT") {
        try { await fetch("/api/pos/reconciliation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ queueId: entry.id, terminalId, barcode: entry.barcode, reason: entry.conflictReason ?? "Server rejected the queued sale. Manager review is required before retrying.", attempts: entry.attempts }) }); } catch { /* Retry publishing the conflict on the next sync cycle. */ }
        break;
      }
      const outcome = await sendSale(entry.barcode, true);
      if (outcome === "synced") remaining = remaining.filter((item) => item.id !== entry.id);
      else if (outcome === "conflict") {
        const reason = replayReasonRef.current;
        remaining = remaining.map((item) => item.id === entry.id ? { ...item, state: "CONFLICT" as const, conflictReason: reason, attempts: item.attempts + 1 } : item);
        try { await fetch("/api/pos/reconciliation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ queueId: entry.id, terminalId, barcode: entry.barcode, reason, attempts: entry.attempts + 1 }) }); } catch { /* The local conflict remains visible until the API is reachable. */ }
        writeQueue(terminalId, remaining); setQueue([...remaining]); break;
      }
      else { remaining = remaining.map((item) => item.id === entry.id ? { ...item, attempts: item.attempts + 1 } : item); break; }
      writeQueue(terminalId, remaining); setQueue([...remaining]);
    }
    writeQueue(terminalId, remaining); setQueue(remaining); setSyncing(false); replayingRef.current = false;
  }, [sendSale, terminalId]);

  const reconcileDecisions = useCallback(async () => {
    if (!navigator.onLine) return;
    try {
      const response = await fetch(`/api/pos/reconciliation?terminalId=${encodeURIComponent(terminalId)}`, { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json() as { items?: Array<{ queueId: string; status: string }> };
      const decisions = new Map((data.items ?? []).map((item) => [item.queueId, item.status]));
      const current = readQueue(terminalId);
      const updated = current.flatMap((entry) => {
        const decision = decisions.get(entry.id);
        if (decision === "DISCARDED") return [];
        if (decision === "RETRY") return [{ ...entry, state: "PENDING" as const, conflictReason: undefined }];
        return [entry];
      });
      if (JSON.stringify(updated) !== JSON.stringify(current)) { writeQueue(terminalId, updated); setQueue(updated); }
    } catch { /* Offline terminals keep their local queue until the next poll. */ }
  }, [terminalId]);

  useEffect(() => { void reconcileDecisions(); void syncQueue(); const timer = window.setInterval(() => { void reconcileDecisions(); void syncQueue(); }, 15000); return () => window.clearInterval(timer); }, [reconcileDecisions, syncQueue]);

  async function submitScan(value = barcode) {
    const normalized = value.replace(/\D/g, "");
    if (!normalized || scanning) return;
    if (normalized.length !== 14) { setError("Enter or scan the complete 14-digit ticket barcode."); return; }
    setScanning(true); setError(""); setResult(null); setBarcode("");
    if (!navigator.onLine) { enqueue(normalized); setScanning(false); focusInput(); return; }
    await sendSale(normalized);
    setScanning(false); focusInput();
  }

  function resetForNextScan() { setShowSuccess(false); setResult(null); setError(""); setBarcode(""); focusInput(); }
  const conflictCount = queue.filter((entry) => entry.state === "CONFLICT").length;
  const pendingLabel = conflictCount > 0 ? `${conflictCount} conflict${conflictCount === 1 ? "" : "s"} needs review` : queue.length === 1 ? "1 sale waiting to sync" : `${queue.length} sales waiting to sync`;

  return <div className="min-h-full bg-[#f4f7fb] text-[#17233f]"><main className="mx-auto flex min-h-[calc(100vh-58px)] max-w-[1240px] flex-col px-4 py-4 sm:px-8 sm:py-6 lg:py-8">
    <header className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#087da8]">{storeName} · {terminalId}</p><h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Sell Tickets</h1><p className="mt-1 text-sm text-slate-500">{employeeName} · scan-first POS terminal</p></div><div className="flex flex-wrap items-center justify-end gap-2 text-xs font-bold">{online ? <span className="inline-flex items-center gap-2 bg-emerald-50 px-3 py-2 text-emerald-700"><Wifi size={14} /> Online</span> : <span className="inline-flex items-center gap-2 bg-amber-50 px-3 py-2 text-amber-800"><CloudOff size={14} /> Offline mode</span>}{queue.length > 0 && <button type="button" onClick={() => { void syncQueue(); }} disabled={!online || syncing} className="inline-flex items-center gap-2 bg-[#17233f] px-3 py-2 text-white disabled:opacity-60">{syncing ? <RefreshCw size={14} className="animate-spin" /> : <Cloud size={14} />} {syncing ? "Syncing..." : pendingLabel}</button>}</div></header>
    <section className="grid flex-1 items-stretch gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]"><div className="flex flex-col justify-center border-2 border-[#087da8] bg-white p-5 shadow-[0_8px_0_rgba(8,125,168,0.12)] sm:p-8"><div className="mx-auto w-full max-w-2xl text-center"><div className="mx-auto flex h-20 w-20 items-center justify-center bg-[#087da8] text-white shadow-lg"><ScanLine size={44} /></div><h2 className="mt-5 text-3xl font-black sm:text-4xl">Scan a ticket</h2><p className="mx-auto mt-2 max-w-md text-sm text-slate-500 sm:text-base">Use the hardware scanner, phone camera, or enter the complete 14-digit barcode. Each scan is validated by the server.</p><div className="mt-7 flex gap-3"><input ref={inputRef} value={barcode} onChange={(event) => setBarcode(event.target.value.replace(/\D/g, "").slice(0, 14))} onPaste={(event) => { const value = event.clipboardData.getData("text").replace(/\D/g, ""); setBarcode(value.slice(0, 14)); }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void submitScan(); } }} inputMode="numeric" autoComplete="off" autoFocus placeholder="Scan or enter 14 digits" disabled={scanning} className="min-h-16 min-w-0 flex-1 border-2 border-slate-200 bg-white px-4 font-mono text-lg tracking-wider outline-none focus:border-[#087da8] disabled:bg-slate-100 sm:text-2xl" /><button type="button" onClick={() => { void submitScan(); }} disabled={scanning || barcode.length !== 14} className="min-h-16 min-w-28 bg-[#087da8] px-4 text-base font-black text-white hover:bg-[#066989] disabled:cursor-not-allowed disabled:bg-slate-300">{scanning ? "Checking" : "Sell"}</button></div><PhoneBarcodeScanner onScan={(value) => { setBarcode(value); void submitScan(value); }} disabled={scanning} /><div className="mt-5 flex flex-wrap justify-center gap-2 text-xs font-semibold text-slate-500"><span className="inline-flex items-center gap-1 bg-slate-100 px-3 py-2"><Keyboard size={14} /> Hardware scanner supported</span><span className="inline-flex items-center gap-1 bg-slate-100 px-3 py-2"><LockKeyhole size={14} /> Opening Audit protected</span></div>{!online && <p className="mt-5 border border-amber-200 bg-amber-50 px-3 py-3 text-sm font-bold text-amber-900">Connection lost. Scans will be held on this terminal and synchronized automatically when the connection returns.</p>}{conflictCount > 0 && <p className="mt-3 border border-red-200 bg-red-50 px-3 py-3 text-sm font-bold text-red-800">{conflictCount} queued sale{conflictCount === 1 ? "" : "s"} is blocked pending manager reconciliation. New scans remain paused behind it.</p>}</div></div>
      <aside className="flex flex-col border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center gap-3 border-b border-slate-200 pb-4"><span className="flex h-11 w-11 items-center justify-center bg-blue-50 text-[#087da8]"><Ticket size={23} /></span><div><h2 className="text-xl font-black">Latest scan</h2><p className="text-xs text-slate-500">Server-confirmed sale or sync status</p></div></div>{result?.status === "queued" ? <div className="mt-5 border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-amber-700">Waiting for connection</p><p className="mt-1 font-mono text-sm text-amber-900">{result.ticketBarcode}</p><p className="mt-2 text-sm text-amber-800">This scan is queued locally and is not marked as sold until LottoOps confirms synchronization.</p></div> : !result ? <div className="flex flex-1 flex-col items-center justify-center py-12 text-center text-slate-400"><ScanLine size={42} strokeWidth={1.5} /><p className="mt-4 font-bold">Waiting for a ticket</p><p className="mt-1 text-xs">Keep the scanner ready for the next customer.</p></div> : <div className="mt-5 space-y-4"><div className="bg-emerald-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Sale recorded</p><p className="mt-1 text-xl font-black text-emerald-900">{result.gameName ?? "Lottery ticket"}</p><p className="mt-1 font-mono text-xs text-emerald-800">{result.ticketBarcode ?? result.serialNumber}</p></div><div className="grid grid-cols-2 gap-3"><Detail label="Amount" value={`$${Number(result.salesAmount ?? result.ticketPrice ?? 0).toFixed(2)}`} /><Detail label="Next ticket" value={result.nextTicketNumber == null ? "Sold out" : String(result.nextTicketNumber)} /><Detail label="Display" value={result.slot?.slotNumber ?? "—"} /><Detail label="Pack status" value={result.packStatus ?? "ACTIVE"} /></div><button type="button" onClick={resetForNextScan} className="min-h-14 w-full bg-[#087da8] text-lg font-black text-white hover:bg-[#066989]">Scan next ticket</button></div>}</aside></section>
    {error && <div className="mt-5 flex items-start gap-3 border-2 border-red-200 bg-red-50 px-4 py-4 text-red-900" role="alert"><AlertTriangle className="mt-0.5 shrink-0" size={21} /><div><p className="font-black">Scan blocked</p><p className="mt-1 text-sm">{error}</p></div><button type="button" onClick={() => setError("")} className="ml-auto p-1 hover:bg-red-100" aria-label="Dismiss error"><X size={18} /></button></div>}
  </main>{showSuccess && result && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#17233f]/55 p-4" role="dialog" aria-modal="true" aria-label="Sale complete"><div className="w-full max-w-md bg-white p-7 text-center shadow-2xl"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><CheckCircle2 size={38} /></div><p className="mt-4 text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">Sale complete</p><h2 className="mt-1 text-3xl font-black">Ticket recorded</h2><p className="mt-2 text-slate-500">${Number(result.salesAmount ?? result.ticketPrice ?? 0).toFixed(2)} · {result.gameName ?? "Lottery ticket"}</p><button type="button" onClick={resetForNextScan} className="mt-6 min-h-14 w-full bg-[#087da8] text-lg font-black text-white">Scan next ticket</button></div></div>}</div>;
}

function Detail({ label, value }: { label: string; value: string }) { return <div className="bg-slate-50 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 truncate font-black">{value}</p></div>; }
