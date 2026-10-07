"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Keyboard, LockKeyhole, ScanLine, Ticket, X } from "lucide-react";
import { PhoneBarcodeScanner } from "@/components/inventory/phone-barcode-scanner";

interface PosProps { employeeName: string; storeName: string; terminalId: string; }
interface SaleResult { error?: string; code?: string; gameName?: string; gameNumber?: string; serialNumber?: string; ticketBarcode?: string; ticketPrice?: number | string | null; ticketsSold?: number; salesAmount?: number | string; nextTicketNumber?: number | null; slot?: { slotNumber?: string } | null; packStatus?: string; }

export function LotteryPos({ employeeName, storeName, terminalId }: PosProps) {
  const [barcode, setBarcode] = useState("");
  const [result, setResult] = useState<SaleResult | null>(null);
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  async function submitScan(value = barcode) {
    const normalized = value.replace(/\D/g, "");
    if (!normalized || scanning) return;
    setScanning(true); setError(""); setResult(null); setBarcode("");
    try {
      const response = await fetch("/api/packs/check-serial", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ serialNumber: normalized, liveScan: true, terminalId }) });
      const data = (await response.json()) as SaleResult;
      if (!response.ok) throw new Error(data.error || "Unable to complete the ticket sale.");
      setResult(data); setShowSuccess(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to complete the ticket sale.");
    } finally {
      setScanning(false); window.setTimeout(() => inputRef.current?.focus(), 80);
    }
  }

  function resetForNextScan() { setShowSuccess(false); setResult(null); setError(""); setBarcode(""); window.setTimeout(() => inputRef.current?.focus(), 80); }

  return <div className="min-h-full bg-[#f4f7fb] text-[#17233f]">
    <main className="mx-auto flex min-h-[calc(100vh-58px)] max-w-[1180px] flex-col px-5 py-6 sm:px-8 lg:py-8">
      <header className="mb-6 flex items-end justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#087da8]">{storeName} · {terminalId}</p><h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Scan Ticket</h1><p className="mt-1 text-sm text-slate-500">{employeeName} · Live sale terminal</p></div><div className="flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-700"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Scanner ready</div></header>
      <section className="grid flex-1 items-stretch gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
        <div className="flex flex-col justify-center rounded-2xl border-2 border-[#087da8] bg-white p-5 shadow-[0_8px_0_rgba(8,125,168,0.12)] sm:p-8"><div className="mx-auto w-full max-w-2xl text-center"><div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-[#087da8] text-white shadow-lg"><ScanLine size={44} /></div><h2 className="mt-5 text-3xl font-black sm:text-4xl">Scan a ticket</h2><p className="mx-auto mt-2 max-w-md text-sm text-slate-500 sm:text-base">Use the barcode scanner or enter the complete 14-digit ticket barcode. One scan records one sale.</p><div className="mt-7 flex gap-3"><input ref={inputRef} value={barcode} onChange={(event) => setBarcode(event.target.value.replace(/\D/g, ""))} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void submitScan(); } }} inputMode="numeric" autoComplete="off" placeholder="Enter or scan 14-digit barcode" disabled={scanning} className="min-h-16 min-w-0 flex-1 rounded-xl border-2 border-slate-200 bg-white px-4 font-mono text-lg tracking-wider outline-none focus:border-[#087da8] disabled:bg-slate-100 sm:text-2xl" /><button type="button" onClick={() => { void submitScan(); }} disabled={scanning || barcode.length === 0} className="min-h-16 min-w-28 rounded-xl bg-[#087da8] px-4 text-base font-black text-white hover:bg-[#066989] disabled:cursor-not-allowed disabled:bg-slate-300">{scanning ? "Checking" : "Sell"}</button></div><PhoneBarcodeScanner onScan={(value) => { setBarcode(value); void submitScan(value); }} disabled={scanning} /><div className="mt-5 flex flex-wrap justify-center gap-2 text-xs font-semibold text-slate-500"><span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-2"><Keyboard size={14} /> Hardware scanner supported</span><span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-2"><LockKeyhole size={14} /> Opening Audit protected</span></div></div></div>
        <aside className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center gap-3 border-b border-slate-200 pb-4"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-[#087da8]"><Ticket size={23} /></span><div><h2 className="text-xl font-black">Latest scan</h2><p className="text-xs text-slate-500">Sale result appears here</p></div></div>{!result ? <div className="flex flex-1 flex-col items-center justify-center py-12 text-center text-slate-400"><ScanLine size={42} strokeWidth={1.5} /><p className="mt-4 font-bold">Waiting for a ticket</p><p className="mt-1 text-xs">Keep the scanner ready for the next customer.</p></div> : <div className="mt-5 space-y-4"><div className="rounded-xl bg-emerald-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Sale recorded</p><p className="mt-1 text-xl font-black text-emerald-900">{result.gameName ?? "Lottery ticket"}</p><p className="mt-1 font-mono text-xs text-emerald-800">{result.ticketBarcode ?? result.serialNumber}</p></div><div className="grid grid-cols-2 gap-3"><Detail label="Amount" value={`$${Number(result.salesAmount ?? result.ticketPrice ?? 0).toFixed(2)}`} /><Detail label="Next ticket" value={result.nextTicketNumber == null ? "Sold out" : String(result.nextTicketNumber)} /><Detail label="Display" value={result.slot?.slotNumber ?? "—"} /><Detail label="Pack status" value={result.packStatus ?? "ACTIVE"} /></div><button type="button" onClick={resetForNextScan} className="min-h-14 w-full rounded-xl bg-[#087da8] text-lg font-black text-white hover:bg-[#066989]">Scan next ticket</button></div>}</aside>
      </section>
      {error && <div className="mt-5 flex items-start gap-3 rounded-xl border-2 border-red-200 bg-red-50 px-4 py-4 text-red-900" role="alert"><AlertTriangle className="mt-0.5 shrink-0" size={21} /><div><p className="font-black">Scan blocked</p><p className="mt-1 text-sm">{error}</p></div><button type="button" onClick={() => setError("")} className="ml-auto rounded-lg p-1 hover:bg-red-100" aria-label="Dismiss error"><X size={18} /></button></div>}
    </main>
    {showSuccess && result && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#17233f]/55 p-4" role="dialog" aria-modal="true" aria-label="Sale complete"><div className="w-full max-w-md rounded-2xl bg-white p-7 text-center shadow-2xl"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><CheckCircle2 size={38} /></div><p className="mt-4 text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">Sale complete</p><h2 className="mt-1 text-3xl font-black">Ticket recorded</h2><p className="mt-2 text-slate-500">${Number(result.salesAmount ?? result.ticketPrice ?? 0).toFixed(2)} · {result.gameName ?? "Lottery ticket"}</p><button type="button" onClick={resetForNextScan} className="mt-6 min-h-14 w-full rounded-xl bg-[#087da8] text-lg font-black text-white">Scan next ticket</button></div></div>}
  </div>;
}

function Detail({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 truncate font-black">{value}</p></div>; }
