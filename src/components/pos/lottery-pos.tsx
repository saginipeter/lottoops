"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Banknote, CheckCircle2, Keyboard, LockKeyhole, ReceiptText, ScanLine, ShoppingCart, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { PhoneBarcodeScanner } from "@/components/inventory/phone-barcode-scanner";
import { formatCurrency } from "@/lib/utils";

interface PosProps {
  shiftOpen: boolean;
  beginningAuditComplete: boolean;
  terminalId: string;
}

interface SaleResult {
  status?: string;
  error?: string;
  code?: string;
  gameName?: string;
  gameNumber?: string;
  serialNumber?: string;
  ticketBarcode?: string;
  ticketPrice?: number | string | null;
  ticketsSold?: number;
  salesAmount?: number | string;
  nextTicketNumber?: number | null;
  slot?: { slotNumber?: string } | null;
  packStatus?: string;
}

export function LotteryPos({ shiftOpen, beginningAuditComplete, terminalId }: PosProps) {
  const [barcode, setBarcode] = useState("");
  const [lastSale, setLastSale] = useState<SaleResult | null>(null);
  const [cashReceived, setCashReceived] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [scanning, setScanning] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const amountDue = Number(lastSale?.ticketPrice ?? lastSale?.salesAmount ?? 0);
  const cash = Number(cashReceived || 0);
  const change = cash >= amountDue && amountDue > 0 ? cash - amountDue : 0;
  const blocked = !shiftOpen || !beginningAuditComplete;

  async function submitScan(value = barcode) {
    const normalized = value.replace(/\D/g, "");
    if (!normalized) return;
    setScanning(true);
    setError("");
    setNotice("");
    setLastSale(null);
    setCashReceived("");
    try {
      const response = await fetch("/api/packs/check-serial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serialNumber: normalized, liveScan: true, terminalId }),
      });
      const data = (await response.json()) as SaleResult;
      if (!response.ok) throw new Error(data.error || "Ticket sale was rejected.");
      setLastSale(data);
      setShowDetails(true);
      setBarcode("");
      setNotice("Ticket sale recorded in the current shift.");
      window.setTimeout(() => inputRef.current?.focus(), 50);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to complete the ticket sale.");
      window.setTimeout(() => inputRef.current?.focus(), 50);
    } finally {
      setScanning(false);
    }
  }

  function clearSale() {
    setLastSale(null);
    setShowDetails(false);
    setCashReceived("");
    setNotice("");
    setError("");
    setBarcode("");
    inputRef.current?.focus();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-bg">
      <div className="mx-auto w-full max-w-[1500px] flex-1 p-4 sm:p-5 lg:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-tertiary">Phase 1 · Lottery POS</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-text sm:text-3xl">New ticket sale</h1><p className="mt-1 text-sm text-text-secondary">Scan one ticket. LottoOps validates the sequence and records the sale to the open shift.</p></div>
          <div className={`flex items-center gap-2 border px-3 py-2 text-xs font-bold ${blocked ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}><span className={`h-2.5 w-2.5 rounded-full ${blocked ? "bg-amber-500" : "bg-emerald-500"}`} />{blocked ? "Sales locked" : "POS ready"}</div>
        </div>

        {blocked && <Panel className="mb-4 border-amber-200 bg-amber-50 p-4 text-amber-900"><div className="flex items-start gap-3"><LockKeyhole size={19} className="mt-0.5 shrink-0" /><div><p className="font-bold">{!shiftOpen ? "Open a shift before selling" : "Complete the Opening Audit before selling"}</p><p className="mt-1 text-sm">The POS will unlock only after the current shift and its Opening Audit are complete.</p></div></div></Panel>}

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(340px,0.7fr)]">
          <Panel className="p-4 sm:p-6">
            <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center border border-accent/25 bg-accent-soft text-accent"><ScanLine size={23} /></span><div><h2 className="text-lg font-bold text-text">Scan ticket</h2><p className="text-xs text-text-secondary">Use the hardware scanner or enter the 14-digit code.</p></div></div><span className="hidden items-center gap-1 text-xs text-text-tertiary sm:flex"><Keyboard size={14} /> Scanner ready</span></div>
            <div className="mt-5 flex gap-2"><input ref={inputRef} value={barcode} onChange={(event) => setBarcode(event.target.value.replace(/\D/g, ""))} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void submitScan(); } }} inputMode="numeric" autoComplete="off" disabled={blocked || scanning} placeholder="Scan ticket barcode" className="min-h-14 min-w-0 flex-1 border-2 border-border bg-white px-4 font-mono text-xl tracking-wider text-text outline-none focus:border-accent disabled:bg-surface-soft" /><Button type="button" onClick={() => { void submitScan(); }} disabled={blocked || scanning || barcode.length === 0} className="min-h-14 min-w-24 text-base">{scanning ? "Checking" : "Sell"}</Button></div>
            <PhoneBarcodeScanner onScan={(value) => { setBarcode(value); void submitScan(value); }} disabled={blocked || scanning} />
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-text-tertiary"><span className="inline-flex items-center gap-1 border border-border bg-surface-soft px-2 py-1"><ShoppingCart size={13} /> One scan = one sale</span><span className="inline-flex items-center gap-1 border border-border bg-surface-soft px-2 py-1"><LockKeyhole size={13} /> Sequence protected</span></div>
            {(error || notice) && <div role="status" className={`mt-4 flex items-start gap-2 border px-3 py-3 text-sm ${error ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{error ? <AlertTriangle size={17} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={17} className="mt-0.5 shrink-0" />}<span>{error || notice}</span></div>}
          </Panel>

          <Panel className="flex min-h-[360px] flex-col p-4 sm:p-6">
            <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><ReceiptText size={18} className="text-accent" /><h2 className="text-lg font-bold text-text">Current transaction</h2></div>{lastSale && <Button type="button" variant="ghost" size="sm" onClick={clearSale}><X size={14} /> Clear</Button>}</div>
            {!lastSale ? <div className="flex flex-1 flex-col items-center justify-center py-12 text-center"><span className="flex h-16 w-16 items-center justify-center border border-border bg-surface-soft text-text-tertiary"><ShoppingCart size={27} /></span><p className="mt-4 font-semibold text-text">No ticket scanned</p><p className="mt-1 max-w-xs text-sm text-text-secondary">The scanned ticket and payment summary will appear here.</p></div> : <div className="mt-5 flex flex-1 flex-col"><div className="border border-border bg-surface-soft p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-text-tertiary">Lottery ticket</p><p className="mt-1 text-lg font-bold text-text">{lastSale.gameName ?? "Lottery ticket"}</p><p className="mt-1 font-mono text-xs text-text-secondary">{lastSale.ticketBarcode ?? lastSale.serialNumber}</p></div><CheckCircle2 size={22} className="text-emerald-600" /></div><div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><p className="text-xs text-text-tertiary">Display</p><p className="font-semibold text-text">{lastSale.slot?.slotNumber ?? "—"}</p></div><div><p className="text-xs text-text-tertiary">Next ticket</p><p className="font-semibold text-text">{lastSale.nextTicketNumber ?? "Sold out"}</p></div></div></div><div className="mt-5 flex items-center justify-between border-b border-border pb-3"><span className="text-sm text-text-secondary">Amount due</span><span className="text-2xl font-bold text-text">{formatCurrency(amountDue)}</span></div><label className="mt-4 block text-sm font-semibold text-text">Cash received<input value={cashReceived} onChange={(event) => setCashReceived(event.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" placeholder="0.00" className="mt-1 min-h-12 w-full border-2 border-border bg-white px-3 text-xl font-bold text-text outline-none focus:border-accent" /></label><div className="mt-4 flex items-center justify-between border border-emerald-200 bg-emerald-50 px-3 py-3"><span className="flex items-center gap-2 text-sm font-semibold text-emerald-800"><Banknote size={17} /> Change due</span><span className="text-xl font-bold text-emerald-800">{formatCurrency(change)}</span></div><p className="mt-3 text-xs text-text-tertiary">The sale is already recorded against the current shift. Cash drawer and payment tender controls are planned for the next POS phase.</p></div>}
          </Panel>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4"><InfoTile label="Shift" value={shiftOpen ? "Open" : "Closed"} /><InfoTile label="Opening audit" value={beginningAuditComplete ? "Complete" : "Required"} /><InfoTile label="Terminal" value={terminalId} /><InfoTile label="Workflow" value="Ticket sales" /></div>
      </div>
      {showDetails && lastSale && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#17233f]/55 p-4" role="dialog" aria-modal="true" aria-label="Completed ticket sale"><Panel className="w-full max-w-lg border-2 border-emerald-500 bg-white p-5 shadow-2xl sm:p-7"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-700">Sale complete</p><h2 className="mt-1 text-2xl font-bold text-text">Ticket recorded</h2></div><Button type="button" variant="ghost" size="icon" onClick={() => setShowDetails(false)} aria-label="Close sale details"><X size={20} /></Button></div><div className="mt-5 grid grid-cols-2 gap-3"><div className="col-span-2 border border-border bg-surface-soft p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">Game</p><p className="mt-1 text-lg font-bold text-text">{lastSale.gameName ?? "Lottery ticket"}</p></div><div className="border border-border bg-surface-soft p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">Amount due</p><p className="mt-1 text-xl font-bold text-text">{formatCurrency(amountDue)}</p></div><div className="border border-border bg-surface-soft p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">Next ticket</p><p className="mt-1 text-xl font-bold text-text">{lastSale.nextTicketNumber ?? "Sold out"}</p></div></div><Button type="button" onClick={() => { setShowDetails(false); inputRef.current?.focus(); }} className="mt-5 min-h-14 w-full text-lg font-bold">Done · Sell Next Ticket</Button></Panel></div>}
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) { return <div className="border border-border bg-surface px-3 py-3"><p className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">{label}</p><p className="mt-1 text-sm font-bold text-text">{value}</p></div>; }
