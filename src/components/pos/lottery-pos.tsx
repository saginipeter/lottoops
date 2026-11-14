"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Cloud, CloudOff, Keyboard, LockKeyhole, RefreshCw, RotateCcw, ScanLine, Ticket, Wifi, X } from "lucide-react";
import { PhoneBarcodeScanner } from "@/components/inventory/phone-barcode-scanner";
import { nextPendingPosQueueEntry, parsePosOfflineQueue, type PosQueueEntry } from "@/lib/pos-offline-queue";
import { formatTicketScanBlockedMessage } from "@/lib/pos-scan-message";

interface PosProps { storeId: string; operatorId: string; loginSessionId: string; employeeName: string; storeName: string; terminalId: string; shiftId: string; shiftNumber: number | null; }
interface SaleResult { error?: string; code?: string; id?: string; packId?: string; expectedTicket?: number; scannedTicketNumber?: number; noSale?: boolean; shiftId?: string; saleId?: string; gameName?: string; gameNumber?: string; serialNumber?: string; ticketBarcode?: string; ticketPrice?: number | string | null; ticketsSold?: number; salesAmount?: number | string; nextTicketNumber?: number | null; slot?: { slotNumber?: string } | null; packStatus?: string; status?: string; }
interface ReturnableSale { packId: string; shiftId: string; saleId: string; ticketBarcode: string; gameName: string; serialNumber: string; slotNumber: string; salesAmount: number; }
type QueueEntry = PosQueueEntry;
const QUEUE_PREFIX = "lottoops:pos-offline-queue:";
const POS_ERROR_NOTICE_MS = 4000;
const POS_SUCCESS_NOTICE_MS = 3500;
const RETURN_REASONS = [
  "Customer declined the ticket",
  "Wrong game tracked",
  "Scanned by mistake",
  "Damaged or misprinted ticket",
  "Duplicate scan",
];

function queueKey(storeId: string, terminalId: string, shiftId: string, operatorId: string) { return `${QUEUE_PREFIX}${encodeURIComponent(storeId)}:${encodeURIComponent(terminalId)}:${encodeURIComponent(shiftId)}:${encodeURIComponent(operatorId)}`; }
function makeId() { return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `offline-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
function readQueue(storeId: string, terminalId: string, shiftId: string, operatorId: string): QueueEntry[] { return parsePosOfflineQueue(window.localStorage.getItem(queueKey(storeId, terminalId, shiftId, operatorId))); }
function writeQueue(storeId: string, terminalId: string, shiftId: string, operatorId: string, queue: QueueEntry[]) {
  try {
    window.localStorage.setItem(queueKey(storeId, terminalId, shiftId, operatorId), JSON.stringify(queue));
    return true;
  } catch {
    return false;
  }
}

export function LotteryPos(props: PosProps) {
  return <StoreLotteryPos key={JSON.stringify([props.storeId, props.operatorId, props.loginSessionId, props.terminalId, props.shiftId])} {...props} />;
}

function StoreLotteryPos({ storeId, operatorId, loginSessionId, employeeName, storeName, terminalId, shiftId, shiftNumber }: PosProps) {
  const [barcode, setBarcode] = useState("");
  const [result, setResult] = useState<SaleResult | null>(null);
  const [error, setError] = useState<{ message: string; status?: number; packId?: string } | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [pendingScanCount, setPendingScanCount] = useState(0);
  const [online, setOnline] = useState(true);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [lastSale, setLastSale] = useState<SaleResult | null>(null);
  const [sessionSales, setSessionSales] = useState<ReturnableSale[]>([]);
  const [selectedReturnSaleIds, setSelectedReturnSaleIds] = useState<string[]>([]);
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnReason, setReturnReason] = useState("");
  const [returning, setReturning] = useState(false);
  const [returnMessage, setReturnMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const replayingRef = useRef(false);
  const activeRef = useRef(false);
  const syncRequestedWhileRunningRef = useRef(false);
  const syncQueueRef = useRef<() => void>(() => {});
  const volatileConflictIdsRef = useRef(new Set<string>());
  const replayReasonRef = useRef("Server could not confirm the queued ticket scan. Manager review is required before retrying.");

  useEffect(() => {
    activeRef.current = true;
    return () => { activeRef.current = false; };
  }, []);

  const refreshQueue = useCallback(() => {
    try {
      const current = readQueue(storeId, terminalId, shiftId, operatorId);
      setQueue(current);
      setPendingScanCount(current.length);
    } catch (queueError) {
      setError({ message: queueError instanceof Error ? queueError.message : "Saved scan queue data is invalid. Contact a manager before scanning again.", status: 503 });
    }
  }, [operatorId, storeId, terminalId, shiftId]);
  const focusInput = useCallback(() => window.setTimeout(() => inputRef.current?.focus(), 80), []);
  useEffect(() => {
    if (!error) return;
    setSuccessNotice(null);
    const timer = window.setTimeout(() => setError(null), POS_ERROR_NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [error]);

  useEffect(() => {
    if (!successNotice) return;
    const timer = window.setTimeout(() => setSuccessNotice(null), POS_SUCCESS_NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [successNotice]);

  useEffect(() => {
    if (!returnMessage) return;
    const timer = window.setTimeout(() => setReturnMessage(null), POS_ERROR_NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [returnMessage]);

  const enqueue = useCallback((value: string) => {
    try {
      const next = [...readQueue(storeId, terminalId, shiftId, operatorId), { id: makeId(), barcode: value, shiftId, loginSessionId, queuedAt: new Date().toISOString(), attempts: 0, state: "PENDING" as const }];
      if (!writeQueue(storeId, terminalId, shiftId, operatorId, next)) {
        setError({ message: "This terminal could not save the scan locally. No ticket was tracked. Restore storage or the connection and scan again.", status: 503 });
        return false;
      }
      setQueue(next); setPendingScanCount(next.length); setResult({ status: "queued", ticketBarcode: value });
      setError((current) => current?.packId ? current : null);
      if (navigator.onLine && replayingRef.current) syncRequestedWhileRunningRef.current = true;
      return true;
    } catch (queueError) {
      setError({ message: queueError instanceof Error ? queueError.message : "Saved scan queue data is invalid. Preserve it and contact a manager before scanning again.", status: 503 });
      return false;
    }
  }, [loginSessionId, operatorId, storeId, terminalId, shiftId]);

  const sendSale = useCallback(async (value: string, isReplay = false, targetShiftId = shiftId, clientRequestId = "", targetLoginSessionId = loginSessionId): Promise<"synced" | "retry" | "conflict" | "store-changed" | "rejected-no-sale"> => {
    try {
      const response = await fetch("/api/packs/check-serial", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ serialNumber: value, liveScan: true, terminalId, expectedStoreId: storeId, shiftId: targetShiftId, clientRequestId, loginSessionId: targetLoginSessionId }) });
      const data = (await response.json()) as SaleResult;
      if (response.ok) {
        setError((current) => current?.packId && current.packId !== data.id ? current : null);
        setSuccessNotice(data.gameName ?? "Lottery ticket");
        setResult(data);
        setLastSale(data);
        if (data.id && data.shiftId && data.saleId && data.ticketBarcode) {
          setSessionSales((current) => [{ packId: data.id as string, shiftId: data.shiftId as string, saleId: data.saleId as string, ticketBarcode: data.ticketBarcode as string, gameName: data.gameName ?? "Lottery ticket", serialNumber: data.serialNumber ?? "", slotNumber: data.slot?.slotNumber ?? "—", salesAmount: Number(data.salesAmount ?? data.ticketPrice ?? 0) }, ...current.filter((sale) => sale.saleId !== data.saleId)].slice(0, 20));
        }
        setReturnMessage(null);
        return "synced";
      }
      if (data.code === "STORE_CHANGED") {
        const rejectionReason = formatTicketScanBlockedMessage({ code: data.code, error: data.error, status: response.status });
        if (isReplay) replayReasonRef.current = rejectionReason;
        setError({ message: rejectionReason, status: response.status });
        setResult(lastSale);
        return "store-changed";
      }
      const rejectionReason = formatTicketScanBlockedMessage({ code: data.code, error: data.error, status: response.status, expectedTicket: data.expectedTicket, scannedTicketNumber: data.scannedTicketNumber });
      if (data.code === "TICKET_SEQUENCE_MISMATCH" || data.code === "INVALID_TICKET_NUMBER") {
        setError({ message: rejectionReason, status: response.status, packId: data.packId });
        setResult(lastSale);
        return "rejected-no-sale";
      }
      if (isReplay) replayReasonRef.current = rejectionReason;
      setError({ message: rejectionReason, status: response.status });
      setResult(lastSale);
      return isReplay && response.status >= 500 ? "retry" : isReplay ? "conflict" : "synced";
    } catch {
      return "retry";
    }
  }, [lastSale, loginSessionId, shiftId, storeId, terminalId]);

  const syncQueue = useCallback(async () => {
    if (!navigator.onLine || replayingRef.current) return;
    replayingRef.current = true; setSyncing(true);
    try {
      const pending = readQueue(storeId, terminalId, shiftId, operatorId);
      if (pending.length === 0) { setQueue([]); setPendingScanCount(0); return; }
      while (activeRef.current && navigator.onLine) {
        const remaining = readQueue(storeId, terminalId, shiftId, operatorId);
        const entry = nextPendingPosQueueEntry(remaining, volatileConflictIdsRef.current);
        if (!entry) {
          for (const conflict of remaining.filter((item) => item.state === "CONFLICT" || volatileConflictIdsRef.current.has(item.id))) {
            try { await fetch("/api/pos/reconciliation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ queueId: conflict.id, terminalId, expectedStoreId: storeId, barcode: conflict.barcode, shiftId: conflict.shiftId ?? shiftId, reason: conflict.conflictReason ?? "Server could not confirm the queued ticket scan. Manager review is required before retrying.", attempts: conflict.attempts }) }); } catch { /* Retry publishing the conflict on the next sync cycle. */ }
          }
          break;
        }
        const outcome = await sendSale(entry.barcode, true, entry.shiftId ?? shiftId, entry.id, entry.loginSessionId ?? "");
        if (!activeRef.current) break;
        const current = readQueue(storeId, terminalId, shiftId, operatorId);
        if (outcome === "synced") {
          const next = current.filter((item) => item.id !== entry.id);
          if (!writeQueue(storeId, terminalId, shiftId, operatorId, next)) {
            setError({ message: "A confirmed ticket tracking record could not update the local sync queue. Contact a manager before retrying this barcode.", status: 503 });
            break;
          }
          setQueue(next);
          setPendingScanCount(next.length);
          continue;
        }
        if (outcome === "rejected-no-sale") {
          const next = current.filter((item) => item.id !== entry.id);
          if (!writeQueue(storeId, terminalId, shiftId, operatorId, next)) {
            setError({ message: "The rejected scan did not track a ticket, but this terminal could not clear it from the local queue. Restore storage before leaving this screen.", status: 503 });
            break;
          }
          setQueue(next);
          setPendingScanCount(next.length);
          continue;
        }
        if (outcome === "conflict" || outcome === "store-changed") {
          const reason = replayReasonRef.current;
          const next = current.map((item) => item.id === entry.id ? { ...item, state: "CONFLICT" as const, conflictReason: reason, attempts: item.attempts + 1 } : item);
          if (writeQueue(storeId, terminalId, shiftId, operatorId, next)) {
            volatileConflictIdsRef.current.delete(entry.id);
            setQueue(next);
          } else {
            volatileConflictIdsRef.current.add(entry.id);
            setQueue(current.map((item) => item.id === entry.id ? { ...item, state: "CONFLICT", conflictReason: reason, attempts: item.attempts + 1 } : item));
            setError({ message: "A rejected offline scan could not be marked in local storage. It will be skipped for now; restore storage before leaving this screen.", status: 503 });
          }
          try { await fetch("/api/pos/reconciliation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ queueId: entry.id, terminalId, expectedStoreId: storeId, barcode: entry.barcode, shiftId: entry.shiftId ?? shiftId, reason, attempts: entry.attempts + 1 }) }); } catch { /* The local conflict remains visible until the API is reachable. */ }
          continue;
        }
        const next = current.map((item) => item.id === entry.id ? { ...item, attempts: item.attempts + 1 } : item);
        if (writeQueue(storeId, terminalId, shiftId, operatorId, next)) setQueue(next);
        break;
      }
    } catch (queueError) {
      setError({ message: queueError instanceof Error ? queueError.message : "Unable to read or synchronize the local scan queue. No additional tickets were sent.", status: 503 });
    } finally {
      let finalQueue: QueueEntry[] = [];
      try {
        finalQueue = readQueue(storeId, terminalId, shiftId, operatorId);
        setQueue(finalQueue.map((entry) => volatileConflictIdsRef.current.has(entry.id)
          ? { ...entry, state: "CONFLICT", conflictReason: entry.conflictReason ?? "Server could not confirm this queued ticket scan; local conflict state could not be saved." }
          : entry));
        setPendingScanCount(finalQueue.length);
      } catch (queueError) {
        setError({ message: queueError instanceof Error ? queueError.message : "Saved scan queue data is invalid. Preserve it and contact a manager.", status: 503 });
      }
      setSyncing(false);
      replayingRef.current = false;
      focusInput();
      const shouldDrain = activeRef.current && navigator.onLine && syncRequestedWhileRunningRef.current &&
        nextPendingPosQueueEntry(finalQueue, volatileConflictIdsRef.current) !== undefined;
      syncRequestedWhileRunningRef.current = false;
      if (shouldDrain) window.setTimeout(() => syncQueueRef.current(), 0);
    }
  }, [focusInput, operatorId, sendSale, shiftId, storeId, terminalId]);

  useEffect(() => { syncQueueRef.current = () => { void syncQueue(); }; }, [syncQueue]);

  useEffect(() => {
    setOnline(navigator.onLine);
    refreshQueue();
    const onOnline = () => { setOnline(true); refreshQueue(); void syncQueue(); };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => { window.removeEventListener("online", onOnline); window.removeEventListener("offline", onOffline); };
  }, [refreshQueue, syncQueue]);

  const reconcileDecisions = useCallback(async () => {
    if (!navigator.onLine) return;
    try {
      const response = await fetch(`/api/pos/reconciliation?terminalId=${encodeURIComponent(terminalId)}&expectedStoreId=${encodeURIComponent(storeId)}`, { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json() as { items?: Array<{ queueId: string; status: string }> };
      const decisions = new Map((data.items ?? []).map((item) => [item.queueId, item.status]));
      const current = readQueue(storeId, terminalId, shiftId, operatorId);
      const updated = current.flatMap((entry) => {
        const decision = decisions.get(entry.id);
        if (decision === "DISCARDED" || decision === "RETRY") volatileConflictIdsRef.current.delete(entry.id);
        if (decision === "DISCARDED") return [];
        if (decision === "RETRY") return [{ ...entry, state: "PENDING" as const, conflictReason: undefined }];
        return [entry];
      });
      if (JSON.stringify(updated) !== JSON.stringify(current)) {
        if (writeQueue(storeId, terminalId, shiftId, operatorId, updated)) {
          setQueue(updated);
          setPendingScanCount(updated.length);
        } else {
          setError({ message: "Unable to save the manager's reconciliation decision locally. Retry when storage is available.", status: 503 });
        }
      }
    } catch (queueError) { setError({ message: queueError instanceof Error ? queueError.message : "Saved scan queue data is invalid. Preserve it and contact a manager.", status: 503 }); }
  }, [operatorId, shiftId, storeId, terminalId]);

  useEffect(() => { void reconcileDecisions(); void syncQueue(); const timer = window.setInterval(() => { void reconcileDecisions(); void syncQueue(); }, 5000); return () => window.clearInterval(timer); }, [reconcileDecisions, syncQueue]);

  function submitScan(value = barcode) {
    const normalized = value.replace(/\D/g, "");
    if (!normalized) return;
    if (normalized.length !== 14) { setError({ message: "Please scan or enter the complete 14-digit ticket barcode. No ticket was tracked.", status: 400 }); setBarcode(""); focusInput(); return; }
    setBarcode("");
    if (!error?.packId) setError(null);
    if (enqueue(normalized) && navigator.onLine) void syncQueue();
    focusInput();
  }

  function resetForNextScan() { setError((current) => current?.packId ? current : null); setBarcode(""); focusInput(); }

  async function submitReturn() {
    if (!returnReason || returning) return;
    const selected = sessionSales.filter((sale) => selectedReturnSaleIds.includes(sale.saleId));
    const singleSale = selected.length === 1 ? selected[0] : lastSale?.id && lastSale.shiftId && lastSale.saleId && lastSale.ticketBarcode ? { packId: lastSale.id, shiftId: lastSale.shiftId, saleId: lastSale.saleId, ticketBarcode: lastSale.ticketBarcode } : null;
    if (!singleSale) return;
    setReturning(true); setReturnMessage(null);
    try {
      const body = selected.length > 1
        ? { tickets: selected, reason: returnReason }
        : { packId: singleSale.packId, shiftId: singleSale.shiftId, saleId: singleSale.saleId, ticketBarcode: singleSale.ticketBarcode, reason: returnReason };
      const response = await fetch("/api/tickets/return-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => null) as { error?: string; mode?: string } | null;
      if (!response.ok) { setReturnMessage({ type: "error", text: data?.error ?? "Unable to return this ticket." }); return; }
      setReturnMessage({ type: "success", text: `${selected.length > 1 ? `${selected.length} tickets returned` : "Ticket returned"} and available for tracking immediately. Inventory updated; manager notified for review.` });
      const returnedIds = new Set(selected.length > 0 ? selected.map((sale) => sale.saleId) : [singleSale.saleId]);
      setSessionSales((current) => current.filter((sale) => !returnedIds.has(sale.saleId)));
      setSelectedReturnSaleIds([]); setLastSale(null); setResult(null); setReturnOpen(false); setReturnReason("");
    } catch {
      setReturnMessage({ type: "error", text: "Unable to reach LottoOps. Try the return again when online." });
    } finally {
      setReturning(false); focusInput();
    }
  }
  const conflictCount = queue.filter((entry) => entry.state === "CONFLICT").length;
  const pendingLabel = conflictCount > 0 ? `${conflictCount} conflict${conflictCount === 1 ? "" : "s"} needs review` : queue.length === 1 ? "1 scan waiting to sync" : `${queue.length} scans waiting to sync`;

  return <div className="min-h-full bg-[#f4f7fb] text-[#17233f]"><main className="mx-auto flex min-h-[calc(100vh-58px)] max-w-[1240px] flex-col px-4 py-4 sm:px-8 sm:py-6 lg:py-8">
    <header className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#087da8]">{storeName} · {terminalId} · Shift {shiftNumber ?? "—"}</p><h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Track Tickets</h1><p className="mt-1 text-sm text-slate-500">{employeeName} · scan-first POS terminal · Shift {shiftNumber ?? "—"}</p></div><div className="flex flex-wrap items-center justify-end gap-2 text-xs font-bold">{online ? <span className="inline-flex items-center gap-2 bg-emerald-50 px-3 py-2 text-emerald-700"><Wifi size={14} /> Online</span> : <span className="inline-flex items-center gap-2 bg-amber-50 px-3 py-2 text-amber-800"><CloudOff size={14} /> Offline mode</span>}{queue.length > 0 && <button type="button" onClick={() => { void syncQueue(); }} disabled={!online || syncing} className="inline-flex items-center gap-2 bg-[#17233f] px-3 py-2 text-white disabled:opacity-60">{syncing ? <RefreshCw size={14} className="animate-spin" /> : <Cloud size={14} />} {syncing ? "Syncing..." : pendingLabel}</button>}</div></header>
    <section className="grid flex-1 items-stretch gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]"><div className="flex flex-col justify-center border-2 border-[#087da8] bg-white p-5 shadow-[0_8px_0_rgba(8,125,168,0.12)] sm:p-8"><div className="mx-auto w-full max-w-2xl text-center"><div className="mx-auto flex h-20 w-20 items-center justify-center bg-[#087da8] text-white shadow-lg"><ScanLine size={44} /></div><h2 className="mt-5 text-3xl font-black sm:text-4xl">Scan a ticket</h2><p className="mx-auto mt-2 max-w-md text-sm text-slate-500 sm:text-base">Use the hardware scanner, phone camera, or enter the complete 14-digit barcode. Each scan is validated by the server.</p><div className="mt-7 flex gap-3"><input ref={inputRef} value={barcode} onChange={(event) => setBarcode(event.target.value.replace(/\D/g, "").slice(0, 14))} onPaste={(event) => { const value = event.clipboardData.getData("text").replace(/\D/g, ""); setBarcode(value.slice(0, 14)); }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void submitScan(); } }} inputMode="numeric" autoComplete="off" autoFocus placeholder="Scan or enter 14 digits" className="min-h-16 min-w-0 flex-1 border-2 border-slate-200 bg-white px-4 font-mono text-lg tracking-wider outline-none focus:border-[#087da8] disabled:bg-slate-100 sm:text-2xl" /><button type="button" onClick={() => { void submitScan(); }} disabled={barcode.length !== 14} className="min-h-16 min-w-28 bg-[#087da8] px-4 text-base font-black text-white hover:bg-[#066989] disabled:cursor-not-allowed disabled:bg-slate-300">{syncing ? `Checking · ${pendingScanCount} queued` : "Track"}</button></div><PhoneBarcodeScanner onScan={(value) => { setBarcode(value); void submitScan(value); }} /><div className="mt-5 flex flex-wrap justify-center gap-2 text-xs font-semibold text-slate-500"><span className="inline-flex items-center gap-1 bg-slate-100 px-3 py-2"><Keyboard size={14} /> Hardware scanner supported</span><span className="inline-flex items-center gap-1 bg-slate-100 px-3 py-2"><LockKeyhole size={14} /> Opening Audit protected</span></div>{!online && <p className="mt-5 border border-amber-200 bg-amber-50 px-3 py-3 text-sm font-bold text-amber-900">Connection lost. Scans will be held on this terminal and synchronized automatically when the connection returns.</p>}</div></div>
      <aside className="flex flex-col border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center gap-3 border-b border-slate-200 pb-4"><span className="flex h-11 w-11 items-center justify-center bg-blue-50 text-[#087da8]"><Ticket size={23} /></span><div><h2 className="text-xl font-black">Latest scan</h2><p className="text-xs text-slate-500">Server-confirmed ticket tracking or sync status</p></div></div>{result?.status === "queued" ? <div className="mt-5 border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-amber-700">Waiting for connection</p><p className="mt-1 font-mono text-sm text-amber-900">{result.ticketBarcode}</p><p className="mt-2 text-sm text-amber-800">This scan is queued locally and is not marked as tracked until LottoOps confirms synchronization.</p></div> : !result ? <div className="flex flex-1 flex-col items-center justify-center py-12 text-center text-slate-400"><ScanLine size={42} strokeWidth={1.5} /><p className="mt-4 font-bold">Waiting for a ticket</p><p className="mt-1 text-xs">Keep the scanner ready for the next customer.</p></div> : <div className="mt-5 space-y-4"><div className="bg-emerald-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Ticket tracked</p><p className="mt-1 text-xl font-black text-emerald-900">{result.gameName ?? "Lottery ticket"}</p><p className="mt-1 font-mono text-xs text-emerald-800">{result.ticketBarcode ?? result.serialNumber}</p></div><div className="grid grid-cols-2 gap-3"><Detail label="Ticket Value" value={`$${Number(result.salesAmount ?? result.ticketPrice ?? 0).toFixed(2)}`} /><Detail label="Next ticket" value={result.nextTicketNumber == null ? "No tickets remaining" : String(result.nextTicketNumber)} /><Detail label="Display" value={result.slot?.slotNumber ?? "—"} /><Detail label="Pack status" value={result.packStatus === "SOLD_OUT" ? "No tickets remaining" : result.packStatus ?? "Active"} /></div><button type="button" onClick={resetForNextScan} className="min-h-14 w-full bg-[#087da8] text-lg font-black text-white hover:bg-[#066989]">Scan next ticket</button></div>}</aside></section>
    <section className="mt-5 border border-slate-200 bg-white p-4 shadow-sm sm:p-5" aria-label="Return tickets">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center bg-amber-50 text-amber-700"><RotateCcw size={20} /></span><div><h2 className="text-lg font-black">Return tickets</h2><p className="text-xs text-slate-500">Select one or multiple recently tracked tickets from this terminal session. Batch returns are limited to the most recently tracked tickets for each pack.</p></div></div>
        {!returnOpen && <button type="button" onClick={() => { setReturnOpen(true); setReturnMessage(null); }} disabled={sessionSales.length === 0 && !(lastSale?.id && lastSale.shiftId && lastSale.saleId)} className="min-h-12 bg-amber-600 px-5 font-black text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-slate-300">Return Ticket(s)</button>}
      </div>
      {returnOpen && <div className="mt-4 space-y-3">
        <div className="grid gap-2 sm:grid-cols-2">
          {sessionSales.length === 0 ? <p className="border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">No recent ticket is available for return.</p> : sessionSales.map((sale) => {
            const selected = selectedReturnSaleIds.includes(sale.saleId);
            return <label key={sale.saleId} className={`flex cursor-pointer items-center gap-3 border-2 p-3 ${selected ? "border-amber-600 bg-amber-50" : "border-slate-200 bg-white"}`}>
              <input type="checkbox" checked={selected} onChange={() => setSelectedReturnSaleIds((current) => selected ? current.filter((id) => id !== sale.saleId) : [...current, sale.saleId])} className="h-5 w-5 accent-amber-600" />
              <span className="min-w-0"><span className="block truncate text-sm font-black">{sale.gameName} · {sale.ticketBarcode}</span><span className="block text-xs text-slate-500">Display {sale.slotNumber} · Pack {sale.serialNumber} · ${sale.salesAmount.toFixed(2)}</span></span>
            </label>;
          })}
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <label className="sr-only" htmlFor="return-reason">Return reason</label>
          <select id="return-reason" value={returnReason} onChange={(event) => setReturnReason(event.target.value)} className="min-h-12 border-2 border-slate-200 bg-white px-3 font-semibold outline-none focus:border-amber-600">
            <option value="">Select a structured reason…</option>
            {RETURN_REASONS.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
          </select>
          <button type="button" onClick={() => { void submitReturn(); }} disabled={!returnReason || returning || (selectedReturnSaleIds.length === 0 && !lastSale?.saleId)} className="min-h-12 bg-amber-600 px-5 font-black text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-slate-300">{returning ? "Returning..." : `Confirm ${selectedReturnSaleIds.length > 1 ? `${selectedReturnSaleIds.length} Returns` : "Return"}`}</button>
          <button type="button" onClick={() => { setReturnOpen(false); setReturnReason(""); setSelectedReturnSaleIds([]); }} disabled={returning} className="min-h-12 border border-slate-300 px-5 font-bold text-slate-700 hover:bg-slate-50">Cancel</button>
        </div>
      </div>}
      {returnMessage && <p role="status" className={`mt-3 text-sm font-semibold ${returnMessage.type === "success" ? "text-emerald-700" : "text-red-700"}`}>{returnMessage.text}</p>}
    </section>
    {successNotice && !error && <div className="pointer-events-none fixed inset-x-4 top-4 z-[59] mx-auto max-w-4xl border-4 border-emerald-700 bg-emerald-50 px-6 py-7 text-emerald-950 shadow-xl sm:px-10 sm:py-9" role="status" aria-live="polite"><div className="flex items-center gap-4 sm:gap-6"><CheckCircle2 size={48} className="shrink-0 text-emerald-800" /><p className="min-w-0 leading-tight"><span className="block text-3xl font-black sm:text-4xl">Ticket Tracked Successfully</span><span className="mt-1 block break-words text-xl font-bold sm:text-2xl">{successNotice}</span></p></div></div>}{error && <div className="pointer-events-none fixed inset-x-4 top-4 z-[60] mx-auto flex max-w-2xl items-start gap-3 border-2 border-red-600 bg-red-50 px-5 py-5 text-base font-bold leading-6 text-red-900 shadow-2xl sm:text-lg" role="alert" aria-live="assertive"><AlertTriangle className="mt-0.5 shrink-0" size={26} /><div><p className="text-lg font-black sm:text-xl">{error.status && error.status >= 500 ? "Ticket scan error · check status before retrying" : "Ticket scan error · no ticket tracked"}</p><p className="mt-1 font-bold">{error.message}</p></div><button type="button" onClick={() => setError(null)} className="pointer-events-auto ml-auto p-1 hover:bg-red-100" aria-label="Dismiss error"><X size={22} /></button></div>}
  </main></div>;
}

function Detail({ label, value }: { label: string; value: string }) { return <div className="bg-slate-50 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 truncate font-black">{value}</p></div>; }
