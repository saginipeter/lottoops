"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Banknote, CheckCircle2, ChevronLeft, CircleDollarSign, Minus, Plus, ReceiptText, ShoppingCart, Ticket, X } from "lucide-react";

interface PosProps {
  employeeName: string;
  storeName: string;
}

const games = [
  { id: "cash-2", name: "Cash 2", price: 2, color: "bg-[#087da8]" },
  { id: "lucky-5", name: "Lucky 5", price: 5, color: "bg-[#159447]" },
  { id: "gold-10", name: "Gold Rush", price: 10, color: "bg-[#e87512]" },
  { id: "diamond-20", name: "Diamond 20", price: 20, color: "bg-[#d41478]" },
  { id: "mega-25", name: "Mega Win", price: 25, color: "bg-[#d92735]" },
  { id: "silver-1", name: "Silver Star", price: 1, color: "bg-[#536b8d]" },
];

type CartLine = { id: string; name: string; price: number; quantity: number };

export function LotteryPos({ employeeName, storeName }: PosProps) {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cash, setCash] = useState("");
  const [completed, setCompleted] = useState(false);
  const [ticketNumber, setTicketNumber] = useState(245);
  const total = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.quantity, 0), [cart]);
  const change = Math.max(0, Number(cash || 0) - total);

  function addGame(game: (typeof games)[number]) {
    setCart((current) => {
      const existing = current.find((item) => item.id === game.id);
      return existing ? current.map((item) => item.id === game.id ? { ...item, quantity: item.quantity + 1 } : item) : [...current, { ...game, quantity: 1 }];
    });
  }
  function adjust(id: string, amount: number) {
    setCart((current) => current.flatMap((item) => item.id === id ? (item.quantity + amount > 0 ? [{ ...item, quantity: item.quantity + amount }] : []) : [item]));
  }
  function finishSale() {
    if (total <= 0 || Number(cash) < total) return;
    setTicketNumber((value) => value + cart.reduce((sum, item) => sum + item.quantity, 0));
    setCompleted(true);
  }
  function newSale() { setCart([]); setCash(""); setCompleted(false); }

  return <div className="min-h-full bg-[#f4f7fb] text-[#17233f]">
    <header className="border-b border-slate-200 bg-white px-5 py-4 sm:px-8"><div className="mx-auto flex max-w-[1366px] items-center justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#087da8]">{storeName} · POS-01</p><h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Sell Tickets</h1></div><div className="hidden items-center gap-5 text-right text-xs sm:flex"><div><p className="text-slate-500">Employee</p><p className="font-bold">{employeeName}</p></div><div><p className="text-slate-500">Shift</p><p className="font-bold text-emerald-700">SHIFT 2 · OPEN</p></div></div><div className="text-right text-xs sm:hidden"><p className="font-bold">{employeeName}</p><p className="font-bold text-emerald-700">OPEN</p></div></div></header>
    <main className="mx-auto grid max-w-[1366px] gap-5 px-5 py-5 sm:px-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:py-7">
      <section><div className="mb-4 flex items-center justify-between"><div><p className="text-sm font-semibold text-slate-500">Choose a game</p><h2 className="text-xl font-black sm:text-2xl">Tap to add tickets</h2></div><div className="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700"><span className="h-2 w-2 rounded-full bg-emerald-500" />Ready</div></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">{games.map((game) => <button key={game.id} type="button" onClick={() => addGame(game)} className={`flex min-h-[145px] flex-col justify-between rounded-xl p-4 text-left text-white shadow-[0_4px_0_rgba(23,35,63,0.14)] transition-transform hover:-translate-y-1 active:scale-[0.98] focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#17233f] ${game.color}`}><span className="flex h-11 w-11 items-center justify-center rounded-lg bg-white/20"><Ticket size={25} /></span><span><span className="block text-lg font-black sm:text-xl">{game.name}</span><span className="mt-1 block text-sm font-bold text-white/85">${game.price.toFixed(2)} each</span></span></button>)}</div><div className="mt-5 flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-900"><CircleDollarSign size={18} /> Tap a game to add it to the current sale.</div></section>
      <aside className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:min-h-[600px]"><div className="flex items-center justify-between border-b border-slate-200 pb-4"><div className="flex items-center gap-2"><ShoppingCart className="text-[#087da8]" size={22} /><h2 className="text-xl font-black">Current sale</h2></div>{cart.length > 0 && <button type="button" onClick={() => setCart([])} className="text-xs font-bold text-red-600 hover:underline">Clear all</button>}</div><div className="min-h-[210px] flex-1 py-4">{cart.length === 0 ? <div className="flex h-full min-h-[200px] flex-col items-center justify-center text-center text-slate-400"><ReceiptText size={42} strokeWidth={1.5} /><p className="mt-3 font-bold">No tickets added</p><p className="mt-1 text-xs">Select a game to start a sale.</p></div> : <div className="space-y-3">{cart.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3"><div className="min-w-0"><p className="truncate font-bold">{item.name}</p><p className="text-xs text-slate-500">${item.price.toFixed(2)} each</p></div><div className="flex items-center gap-2"><button type="button" onClick={() => adjust(item.id, -1)} aria-label={`Remove one ${item.name}`} className="rounded-lg border border-slate-200 bg-white p-2 hover:bg-slate-100"><Minus size={15} /></button><span className="w-5 text-center font-black">{item.quantity}</span><button type="button" onClick={() => adjust(item.id, 1)} aria-label={`Add one ${item.name}`} className="rounded-lg border border-slate-200 bg-white p-2 hover:bg-slate-100"><Plus size={15} /></button></div></div>)}</div>}</div><div className="border-t border-slate-200 pt-4"><div className="flex items-center justify-between"><span className="font-semibold text-slate-500">Total due</span><span className="text-3xl font-black">${total.toFixed(2)}</span></div><label className="mt-4 block text-sm font-bold">Cash received<input type="text" inputMode="decimal" value={cash} onChange={(event) => setCash(event.target.value.replace(/[^0-9.]/g, ""))} placeholder="0.00" className="mt-2 min-h-14 w-full rounded-xl border-2 border-slate-200 px-4 text-2xl font-black outline-none focus:border-[#087da8]" /></label><div className="mt-3 flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-3"><span className="flex items-center gap-2 text-sm font-bold text-emerald-800"><Banknote size={18} /> Change</span><span className="text-xl font-black text-emerald-800">${change.toFixed(2)}</span></div><button type="button" onClick={finishSale} disabled={total <= 0 || Number(cash) < total} className="mt-4 flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#087da8] text-lg font-black text-white transition hover:bg-[#066989] disabled:cursor-not-allowed disabled:bg-slate-300"><CheckCircle2 size={21} /> Complete Sale</button></div></aside>
    </main>
    <div className="mx-auto flex max-w-[1366px] items-center justify-between px-5 pb-5 text-xs font-semibold text-slate-500 sm:px-8"><Link href="/" className="inline-flex items-center gap-1 hover:text-[#087da8]"><ChevronLeft size={15} /> Back to home</Link><span>Next ticket preview: #{ticketNumber}</span></div>
    {completed && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#17233f]/55 p-4" role="dialog" aria-modal="true" aria-label="Sale complete"><div className="w-full max-w-md rounded-2xl bg-white p-7 text-center shadow-2xl"><button type="button" aria-label="Close" onClick={newSale} className="float-right rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={20} /></button><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><CheckCircle2 size={38} /></div><p className="mt-4 text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">Sale complete</p><h2 className="mt-1 text-3xl font-black">Payment accepted</h2><p className="mt-2 text-slate-500">The ticket sale has been recorded.</p><div className="mt-5 rounded-xl bg-slate-50 p-4"><div className="flex justify-between text-sm"><span className="text-slate-500">Total</span><strong>${total.toFixed(2)}</strong></div><div className="mt-2 flex justify-between text-sm"><span className="text-slate-500">Change</span><strong className="text-emerald-700">${change.toFixed(2)}</strong></div></div><button type="button" onClick={newSale} className="mt-5 min-h-14 w-full rounded-xl bg-[#087da8] text-lg font-black text-white hover:bg-[#066989]">Start next sale</button></div></div>}
  </div>;
}
