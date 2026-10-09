"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ChevronLeft, PackagePlus, Search, X } from "lucide-react";

export type InventoryPack = {
  id: string; game: string; gameNumber: string; serial: string; price: number; tickets: number; currentTicket: number;
  location: string; status: "BACK_STOCK" | "ACTIVE"; direction?: "FIRST" | "LAST"; invoice: string; receivedAt: string;
};
export type InventorySlot = { id: string; slotNumber: string; pack: InventoryPack | null };
type StockAlert = { id: string; severity: string; detail: string };

export function InventoryPos({ employeeName, storeName, packs, slots }: { employeeName: string; storeName: string; packs: InventoryPack[]; slots: InventorySlot[] }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<InventoryPack | null>(null);
  const [livePacks, setLivePacks] = useState(packs);
  const [liveSlots, setLiveSlots] = useState(slots);
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const livePacksRef = useRef(packs);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch("/api/pos/inventory-status", { cache: "no-store" });
        if (!response.ok || !active) return;
        const data = await response.json() as { packs?: Array<{ id: string; serial: string; game: string; gameNumber: string; slotNumber: string | null; remaining: number; quantity: number; price: number; direction: "FIRST" | "LAST" }>; slots?: Array<{ id: string; slotNumber: string; packId: string | null }>; alerts?: StockAlert[]; updatedAt?: string };
        const activeById = new Map((data.packs ?? []).map((pack) => [pack.id, pack]));
        const mergedPacks = livePacksRef.current.map((pack) => { const next = activeById.get(pack.id); return next ? { ...pack, serial: next.serial, game: next.game, gameNumber: next.gameNumber, currentTicket: next.remaining, tickets: next.quantity, price: next.price, direction: next.direction, location: next.slotNumber ? `Display ${next.slotNumber}` : pack.location } : pack; });
        const packById = new Map(mergedPacks.map((pack) => [pack.id, pack]));
        livePacksRef.current = mergedPacks; setLivePacks(mergedPacks); setLiveSlots((data.slots ?? []).map((slot) => ({ id: slot.id, slotNumber: slot.slotNumber, pack: slot.packId ? packById.get(slot.packId) ?? null : null }))); setAlerts(data.alerts ?? []); setUpdatedAt(data.updatedAt ?? null);
      } catch { /* Keep the last known inventory snapshot while offline. */ }
    };
    void refresh(); const timer = window.setInterval(() => { void refresh(); }, 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);
  const visibleSlots = useMemo(() => liveSlots.filter((slot) => !search || `${slot.slotNumber} ${slot.pack?.game ?? ""} ${slot.pack?.serial ?? ""} ${slot.pack?.invoice ?? ""}`.toLowerCase().includes(search.toLowerCase())), [search, liveSlots]);
  const occupied = liveSlots.filter((slot) => slot.pack).length;
  const empty = liveSlots.length - occupied;

  return <div className="min-h-full bg-[#f4f7fb] text-[#17233f]">
    <header className="border-b border-slate-200 bg-white px-5 py-3 sm:px-8"><div className="mx-auto flex max-w-[1366px] items-center justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#087da8]">{storeName} · Inventory control</p><h1 className="mt-1 text-2xl font-black tracking-tight">INVENTORY</h1></div><div className="hidden text-right text-xs sm:block"><p className="text-slate-500">Employee</p><p className="font-bold">{employeeName}</p></div></div></header>
    <main className="mx-auto max-w-[1366px] px-5 py-5 sm:px-8 sm:py-7"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><p className="text-sm font-semibold text-slate-500">Live store inventory</p><h2 className="mt-1 text-2xl font-black">Display map</h2></div><div className="flex flex-wrap items-center gap-2"><div className="relative"><Search className="pointer-events-none absolute left-3 top-3.5 text-slate-400" size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find display or pack" className="min-h-11 w-full rounded-xl border-2 border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-[#087da8] sm:w-56" /></div><Link href="/inventory/receive" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#159447] px-4 text-sm font-black text-white"><PackagePlus size={17} /> Receive</Link></div></div>{alerts.length > 0 && <div className="mt-4 border-2 border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"><div className="flex items-center gap-2 font-black"><AlertTriangle size={16} /> Stock alerts</div><div className="mt-2 grid gap-1 sm:grid-cols-2">{alerts.slice(0, 6).map((alert) => <p key={alert.id} className={alert.severity === "URGENT" ? "font-black text-red-700" : "font-semibold text-amber-800"}>{alert.detail}</p>)}</div><p className="mt-2 text-[10px] text-amber-700">Live update: {updatedAt ? new Date(updatedAt).toLocaleTimeString() : "just now"}</p></div>}<section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3"><p className="text-sm font-bold text-slate-600">{occupied} occupied · {empty} empty · {livePacks.length} total packs</p><div className="flex gap-3 text-[11px] font-bold"><span className="inline-flex items-center gap-1.5"><i className="h-3 w-3 rounded-full bg-[#1688ff]" />Healthy</span><span className="inline-flex items-center gap-1.5"><i className="h-3 w-3 rounded-full bg-[#f59e0b]" />Low</span><span className="inline-flex items-center gap-1.5"><i className="h-3 w-3 rounded-full bg-[#dc2626]" />Sold out</span><span className="inline-flex items-center gap-1.5"><i className="h-3 w-3 rounded-full bg-[#9ca3af]" />Empty</span></div></div><div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10">{liveSlots.length === 0 ? <div className="col-span-full rounded-xl border-2 border-dashed border-slate-300 p-8 text-center text-sm font-bold text-slate-500">No displays configured.</div> : visibleSlots.map((slot) => { const pack = slot.pack; const stockClass = !pack ? "cursor-default border-[#9ca3af] bg-[#9ca3af] text-white hover:bg-[#858b96]" : pack.currentTicket <= 0 ? "border-[#dc2626] bg-[#dc2626] text-white hover:bg-[#b91c1c]" : pack.currentTicket <= 5 ? "border-[#f59e0b] bg-[#f59e0b] text-white hover:bg-[#d97706]" : "border-[#1688ff] bg-[#1688ff] text-white hover:bg-[#0875e1]"; return <button key={slot.id} type="button" onClick={() => pack && setSelected(pack)} disabled={!pack} className={`min-h-[82px] rounded-lg border-2 p-2 text-center shadow-sm transition ${stockClass}`}><p className="text-[10px] font-black uppercase tracking-wide">Display {slot.slotNumber}</p>{pack ? <p className="mt-3 text-2xl font-black leading-none">{pack.currentTicket}<span className="block text-[9px] uppercase tracking-wide">left</span></p> : <p className="mt-4 text-xs font-black uppercase">Empty</p>}</button>; })}{search && visibleSlots.length === 0 && <div className="col-span-full p-8 text-center text-sm font-bold text-slate-500">No matching display or pack.</div>}</div></section></main><div className="mx-auto flex max-w-[1366px] justify-between px-5 pb-5 text-xs font-semibold text-slate-500 sm:px-8"><Link href="/" className="inline-flex items-center gap-1 hover:text-[#087da8]"><ChevronLeft size={15} /> Back to home</Link><span>Touch an occupied display for details</span></div>
    {selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#17233f]/55 p-4" role="dialog" aria-modal="true"><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#087da8]">Pack details</p><h2 className="mt-1 text-2xl font-black">Game {selected.gameNumber}</h2></div><button type="button" onClick={() => setSelected(null)} aria-label="Close" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={20} /></button></div><div className="mt-5 grid grid-cols-2 gap-3"><Detail label="Game" value={selected.game} /><Detail label="Serial" value={selected.serial} /><Detail label="Display" value={selected.location} /><Detail label="Tickets left" value={String(selected.currentTicket)} /><Detail label="Ticket price" value={`$${selected.price.toFixed(2)}`} /><Detail label="Sell direction" value={`Sell from ${selected.direction === "LAST" ? "Last" : "First"}`} /><Detail label="Invoice" value={selected.invoice || "—"} /><Detail label="Received" value={new Date(selected.receivedAt).toLocaleDateString()} /></div><button type="button" onClick={() => setSelected(null)} className="mt-6 min-h-14 w-full rounded-xl bg-[#087da8] text-lg font-black text-white">Close details</button></div></div>}
  </div>;
}
function Detail({ label, value }: { label: string; value: string }) { return <div className="rounded-lg bg-slate-50 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 break-words font-bold">{value}</p></div>; }
