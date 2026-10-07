"use client";

import { useState } from "react";
import Image from "next/image";
import { ArrowRight, BarChart3, Boxes, ClipboardCheck, PackagePlus, Radio, ShoppingCart, X } from "lucide-react";

const actions = [
  { title: "Sell", description: "Start selling tickets", href: "/pos", icon: ShoppingCart, className: "bg-[#087da8]" },
  { title: "Scan", description: "Scan a ticket", href: "/inventory/live-scan?mode=pos", icon: Radio, className: "bg-[#f1b800]" },
  { title: "Receive", description: "Receive new stock", href: "/inventory/receive", icon: PackagePlus, className: "bg-[#159447]" },
  { title: "Inventory", description: "View available stock", href: "/inventory", icon: Boxes, className: "bg-[#d41478]" },
  { title: "Shift", description: "Manage current shift", href: "/shifts", icon: ClipboardCheck, className: "bg-[#e87512]" },
  { title: "Reports", description: "View sales and reports", href: "/reports", icon: BarChart3, className: "bg-[#d92735]" },
];

export function PosHomeDashboard({ employeeName, storeName }: { employeeName: string; storeName: string }) {
  const [shiftOpen, setShiftOpen] = useState(false);
  return (
    <div className="min-h-full bg-[#f4f7fb] text-[#17233f]">
      <header className="mx-auto flex min-h-[72px] w-full max-w-[1366px] items-center justify-between gap-4 bg-[#087da8] px-5 py-3 text-white shadow-sm sm:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <Image src="/brand/lottoops-logo-new.png" alt="LottoOps" width={54} height={54} priority className="h-11 w-11 object-contain" />
          <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">Store operations</p><h1 className="truncate text-xl font-black tracking-tight sm:text-2xl">LottoOps</h1></div>
        </div>
        <div className="hidden items-center gap-6 text-right text-xs sm:flex"><div><p className="text-white/65">Employee</p><p className="font-bold">{employeeName}</p></div><div><p className="text-white/65">Terminal</p><p className="font-bold">POS-01</p></div><div><p className="text-white/65">Shift</p><p className="font-bold text-emerald-200">SHIFT 2 · OPEN</p></div></div>
        <div className="text-right text-xs sm:hidden"><p className="font-bold">{employeeName}</p><p className="text-emerald-200">SHIFT 2 · OPEN</p></div>
      </header>

      <main className="mx-auto w-full max-w-[1366px] px-5 py-5 sm:px-8 sm:py-7">
        <div className="mb-5 flex items-end justify-between gap-4"><div><p className="text-sm font-semibold text-slate-500">{storeName}</p><h2 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">What would you like to do?</h2></div><p className="hidden text-sm font-semibold text-emerald-700 sm:block">Ready for operations</p></div>

        <section className="grid grid-cols-2 gap-4 lg:grid-cols-3 lg:gap-5" aria-label="Main POS actions">
          {actions.map(({ title, description, href, icon: Icon, className }) => <a key={title} href={href} className={`group flex min-h-[150px] flex-col justify-between rounded-xl border-2 border-white p-5 text-white shadow-[0_5px_0_rgba(23,35,63,0.12)] transition-transform hover:-translate-y-1 focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#17233f] active:scale-[0.98] sm:min-h-[185px] sm:p-6 ${className}`}><div className="flex items-start justify-between"><span className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/20 sm:h-16 sm:w-16"><Icon size={34} strokeWidth={2.2} /></span><ArrowRight className="text-white/70 transition-transform group-hover:translate-x-1" size={25} /></div><div><h3 className="text-2xl font-black tracking-tight sm:text-3xl">{title}</h3><p className="mt-1 text-sm font-medium text-white/85 sm:text-base">{description}</p></div></a>)}
        </section>

        <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Essential shift information">
          <Stat label="Today's Sales" value="$2,450" />
          <Stat label="Tickets Sold" value="245" />
          <button type="button" onClick={() => setShiftOpen(true)} className="border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-[#087da8] focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#087da8]"><p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Current Shift</p><p className="mt-2 text-xl font-black sm:text-2xl">Shift 2</p><p className="mt-1 text-xs font-bold text-emerald-700">Tap for details</p></button>
          <Stat label="Shift Status" value="OPEN" valueClass="text-emerald-700" />
        </section>
      </main>

      {shiftOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#17233f]/55 p-4" role="dialog" aria-modal="true" aria-label="Current shift details"><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#087da8]">Current shift</p><h2 className="mt-1 text-2xl font-black">Shift 2</h2></div><button type="button" aria-label="Close shift details" onClick={() => setShiftOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={22} /></button></div><div className="mt-6 grid grid-cols-2 gap-3"><Detail label="Employee" value={employeeName} /><Detail label="Started" value="09:14 AM" /><Detail label="Sales" value="$1,240" /><Detail label="Tickets" value="124" /></div><a href="/shifts" className="mt-6 block rounded-xl bg-[#087da8] px-4 py-3 text-center font-bold text-white hover:bg-[#066989]">View shift details</a></div></div>}
    </div>
  );
}

function Stat({ label, value, valueClass = "text-[#17233f]" }: { label: string; value: string; valueClass?: string }) { return <div className="border border-slate-200 bg-white p-4 shadow-sm"><p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p><p className={`mt-2 text-xl font-black sm:text-2xl ${valueClass}`}>{value}</p></div>; }
function Detail({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-slate-50 p-3"><p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 font-bold text-[#17233f]">{value}</p></div>; }
