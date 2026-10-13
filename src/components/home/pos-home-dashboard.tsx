"use client";

import { AlertTriangle, ArrowRight, BarChart3, Boxes, CheckCircle2, ClipboardCheck, FileText, PackagePlus, Settings, ShoppingCart, Store, Users } from "lucide-react";

type Action = { title: string; description: string; href: string; icon: typeof ShoppingCart; className: string };
type Props = { storeName: string; role: string; grantedPermissions: string[] };

export function PosHomeDashboard({ storeName, role, grantedPermissions }: Props) {
  const isPlatformAdmin = role === "PLATFORM_ADMIN";
  const isOwner = role === "OWNER";
  const isAdmin = role === "OWNER" || role === "MANAGER";
  const canReports = isAdmin || role === "AUDITOR" || grantedPermissions.includes("REPORTS");
  const canReceive = isAdmin || grantedPermissions.includes("RECEIVE_SHIPMENTS");
  const canInventory = isAdmin || role === "SHIFT_LEAD" || grantedPermissions.includes("MANAGE_BACKSTOCK");
  const canDisplay = isAdmin || grantedPermissions.includes("MANAGE_DISPLAY");
  const canSettings = isAdmin;
  const canGames = isAdmin || grantedPermissions.includes("MANAGE_GAMES");
  const canDocuments = canReports;

  const posActions: Action[] = isPlatformAdmin ? [] : [
    { title: "Sell Tickets", description: "Open the cashier terminal", href: "/pos", icon: ShoppingCart, className: "bg-[#087da8]" },
    { title: "Shift", description: "Clock in, audit, and reconcile", href: "/shifts", icon: ClipboardCheck, className: "bg-[#e87512]" },
    ...(canReceive ? [{ title: "Receive Stock", description: "Receive shipment inventory", href: "/inventory/receive", icon: PackagePlus, className: "bg-[#159447]" }] : []),
  ];
  const adminActions: Action[] = [
    ...(isPlatformAdmin ? [{ title: "Platform Admin", description: "Organizations, subscriptions, and system health", href: "/platform-admin", icon: Settings, className: "bg-[#344563]" }] : []),
    ...(canReports ? [{ title: "Reports", description: "Sales, audit, and performance", href: "/admin/reports", icon: BarChart3, className: "bg-[#d92735]" }] : []),
    ...(canInventory ? [
      { title: "Active Stock", description: "Review and manage active display packs", href: "/inventory/active", icon: Boxes, className: "bg-[#d41478]" },
      { title: "Back Stock", description: "Search and activate received packs", href: "/inventory/back-stock", icon: PackagePlus, className: "bg-[#8a4772]" },
    ] : []),
    ...(canDisplay ? [{ title: "Displays", description: "Manage active ticket displays", href: "/display-slots", icon: Store, className: "bg-[#6b46c1]" }] : []),
    ...(canSettings ? [{ title: "Staff & Settings", description: "Users, terminals, and controls", href: "/settings", icon: Settings, className: "bg-[#344563]" }] : []),
    ...(isOwner ? [{ title: "Owner Overview", description: "Store and organization oversight", href: "/owner", icon: Users, className: "bg-[#087da8]" }] : []),
    ...(canGames ? [{ title: "Games", description: "Manage the store game catalogue", href: "/games", icon: Settings, className: "bg-[#159447]" }] : []),
    ...(canDocuments ? [{ title: "Documents", description: "Find invoices, receipts, and compliance records", href: "/documents", icon: FileText, className: "bg-[#39758a]" }] : []),
    ...(isAdmin ? [
      { title: "Alerts", description: "Review operational issues and stock warnings", href: "/alerts", icon: AlertTriangle, className: "bg-[#bd522d]" },
      { title: "Onboarding", description: "Continue store setup and team readiness", href: "/onboarding", icon: CheckCircle2, className: "bg-[#426b52]" },
    ] : []),
  ];

  return <div className="min-h-full bg-[#f4f7fb] text-[#17233f]">
    <main className="mx-auto w-full max-w-[1366px] px-5 py-5 sm:px-8 sm:py-7">
      <div className="mb-5 flex items-end justify-between gap-4"><div><p className="text-sm font-semibold text-slate-500">{storeName}</p><h2 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">{isPlatformAdmin ? "Platform workspace" : isAdmin ? "Management workspace" : "What would you like to do?"}</h2></div><p className="hidden text-sm font-semibold text-emerald-700 sm:block">{isPlatformAdmin || isAdmin ? "Oversight access enabled" : "POS ready"}</p></div>
      <ActionSection title="POS operations" actions={posActions} />
      {adminActions.length > 0 && <div className="mt-8"><ActionSection title={isPlatformAdmin ? "Platform administration" : "Management & oversight"} actions={adminActions} /></div>}
      {role === "AUDITOR" && <div className="mt-5 flex items-center gap-2 border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900"><FileText size={18} /> Read-only audit access. Operational POS actions are hidden.</div>}
    </main>
  </div>;
}

function ActionSection({ title, actions }: { title: string; actions: Action[] }) { return <section aria-label={title}><div className="mb-3 flex items-center gap-3"><h3 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">{title}</h3><span className="h-px flex-1 bg-slate-200" /></div><div className="grid grid-cols-2 gap-4 lg:grid-cols-3 lg:gap-5">{actions.map(({ title: actionTitle, description, href, icon: Icon, className }) => <a key={href} href={href} className={`group flex min-h-[150px] flex-col justify-between rounded-xl border-2 border-white p-5 text-white shadow-[0_5px_0_rgba(23,35,63,0.12)] transition-transform hover:-translate-y-1 focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#17233f] active:scale-[0.98] sm:min-h-[175px] sm:p-6 ${className}`}><div className="flex items-start justify-between"><span className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/20 sm:h-16 sm:w-16"><Icon size={34} strokeWidth={2.2} /></span><ArrowRight className="text-white/70 transition-transform group-hover:translate-x-1" size={25} /></div><div><h4 className="text-xl font-black tracking-tight sm:text-2xl">{actionTitle}</h4><p className="mt-1 text-sm font-medium text-white/85">{description}</p></div></a>)}</div></section>; }
