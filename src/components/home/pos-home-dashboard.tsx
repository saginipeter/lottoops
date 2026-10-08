"use client";

import Image from "next/image";
import { ArrowRight, BarChart3, Boxes, ClipboardCheck, FileText, PackagePlus, Settings, ShoppingCart, Store, Users, X } from "lucide-react";
import { useState } from "react";

type Action = { title: string; description: string; href: string; icon: typeof ShoppingCart; className: string };
type Props = { employeeName: string; storeName: string; role: string; grantedPermissions: string[] };

export function PosHomeDashboard({ employeeName, storeName, role, grantedPermissions }: Props) {
  const [shiftOpen, setShiftOpen] = useState(false);
  const isAdmin = role === "OWNER" || role === "MANAGER";
  const canReports = isAdmin || role === "AUDITOR" || grantedPermissions.includes("REPORTS");
  const canReceive = isAdmin || grantedPermissions.includes("RECEIVE_SHIPMENTS");
  const canInventory = isAdmin || role === "SHIFT_LEAD" || grantedPermissions.includes("MANAGE_BACKSTOCK");
  const canDisplay = isAdmin || grantedPermissions.includes("MANAGE_DISPLAY");
  const canSettings = isAdmin;

  const posActions: Action[] = [
    { title: "Sell Tickets", description: "Open the cashier terminal", href: "/pos", icon: ShoppingCart, className: "bg-[#087da8]" },
    { title: "Shift", description: "Clock in, audit, and reconcile", href: "/shifts", icon: ClipboardCheck, className: "bg-[#e87512]" },
    ...(canReceive ? [{ title: "Receive Stock", description: "Receive shipment inventory", href: "/inventory/receive", icon: PackagePlus, className: "bg-[#159447]" }] : []),
  ];
  const adminActions: Action[] = [
    ...(canReports ? [{ title: "Reports", description: "Sales, audit, and performance", href: "/reports", icon: BarChart3, className: "bg-[#d92735]" }] : []),
    ...(canInventory ? [{ title: "Inventory", description: "Back stock and live inventory", href: "/inventory", icon: Boxes, className: "bg-[#d41478]" }] : []),
    ...(canDisplay ? [{ title: "Displays", description: "Manage active ticket displays", href: "/display-slots", icon: Store, className: "bg-[#6b46c1]" }] : []),
    ...(canSettings ? [
      { title: "Staff & Settings", description: "Users, terminals, and controls", href: "/settings", icon: Settings, className: "bg-[#344563]" },
      { title: "Owner Overview", description: "Store and organization oversight", href: "/owner", icon: Users, className: "bg-[#087da8]" },
    ] : []),
  ];

  return <div className="min-h-full bg-[#f4f7fb] text-[#17233f]">
    <header className="mx-auto flex min-h-[72px] w-full max-w-[1366px] items-center justify-between gap-4 bg-[#087da8] px-5 py-3 text-white shadow-sm sm:px-8">
      <div className="flex min-w-0 items-center gap-3"><Image src="/brand/lottoops-logo-new.png" alt="LottoOps" width={54} height={54} priority className="h-11 w-11 object-contain" /><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">{isAdmin ? "Management console" : "POS operations"}</p><h1 className="truncate text-xl font-black tracking-tight sm:text-2xl">LottoOps</h1></div></div>
      <div className="hidden items-center gap-6 text-right text-xs sm:flex"><div><p className="text-white/65">User</p><p className="font-bold">{employeeName}</p></div><div><p className="text-white/65">Role</p><p className="font-bold">{role.replaceAll("_", " ")}</p></div><div><p className="text-white/65">Store</p><p className="font-bold">{storeName}</p></div></div>
      <div className="text-right text-xs sm:hidden"><p className="font-bold">{employeeName}</p><p className="text-emerald-200">{role.replaceAll("_", " ")}</p></div>
    </header>

    <main className="mx-auto w-full max-w-[1366px] px-5 py-5 sm:px-8 sm:py-7">
      <div className="mb-5 flex items-end justify-between gap-4"><div><p className="text-sm font-semibold text-slate-500">{storeName}</p><h2 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">{isAdmin ? "Management workspace" : "What would you like to do?"}</h2></div><p className="hidden text-sm font-semibold text-emerald-700 sm:block">{isAdmin ? "Oversight access enabled" : "POS ready"}</p></div>
      <ActionSection title="POS operations" actions={posActions} />
      {adminActions.length > 0 && <div className="mt-8"><ActionSection title="Management & oversight" actions={adminActions} /></div>}
      {role === "AUDITOR" && <div className="mt-5 flex items-center gap-2 border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900"><FileText size={18} /> Read-only audit access. Operational POS actions are hidden.</div>}
      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Quick shift access"><button type="button" onClick={() => setShiftOpen(true)} className="border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-[#087da8] focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#087da8]"><p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Shift control</p><p className="mt-2 text-xl font-black">Open Shift</p><p className="mt-1 text-xs font-bold text-[#087da8]">View live status</p></button><a href="/shifts" className="border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-[#087da8]"><p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Reconciliation</p><p className="mt-2 text-xl font-black">Drawer & Audit</p><p className="mt-1 text-xs font-bold text-[#087da8]">Open shift workspace</p></a></section>
    </main>

    {shiftOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#17233f]/55 p-4" role="dialog" aria-modal="true" aria-label="Shift access"><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#087da8]">Shift control</p><h2 className="mt-1 text-2xl font-black">Open the live workspace</h2></div><button type="button" aria-label="Close shift details" onClick={() => setShiftOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={22} /></button></div><p className="mt-5 text-sm leading-6 text-slate-600">Clock in, complete the Opening Audit, manage ticket sales, count the drawer, and close the shift from one place.</p><a href="/shifts" className="mt-6 block rounded-xl bg-[#087da8] px-4 py-3 text-center font-bold text-white hover:bg-[#066989]">Open Shift Management</a></div></div>}
  </div>;
}

function ActionSection({ title, actions }: { title: string; actions: Action[] }) { return <section aria-label={title}><div className="mb-3 flex items-center gap-3"><h3 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">{title}</h3><span className="h-px flex-1 bg-slate-200" /></div><div className="grid grid-cols-2 gap-4 lg:grid-cols-3 lg:gap-5">{actions.map(({ title: actionTitle, description, href, icon: Icon, className }) => <a key={href} href={href} className={`group flex min-h-[150px] flex-col justify-between rounded-xl border-2 border-white p-5 text-white shadow-[0_5px_0_rgba(23,35,63,0.12)] transition-transform hover:-translate-y-1 focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#17233f] active:scale-[0.98] sm:min-h-[175px] sm:p-6 ${className}`}><div className="flex items-start justify-between"><span className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/20 sm:h-16 sm:w-16"><Icon size={34} strokeWidth={2.2} /></span><ArrowRight className="text-white/70 transition-transform group-hover:translate-x-1" size={25} /></div><div><h4 className="text-xl font-black tracking-tight sm:text-2xl">{actionTitle}</h4><p className="mt-1 text-sm font-medium text-white/85">{description}</p></div></a>)}</div></section>; }
