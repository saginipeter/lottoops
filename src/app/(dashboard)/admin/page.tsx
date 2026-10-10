import Link from "next/link";
import { BarChart3, Boxes, CreditCard, Monitor, RefreshCw, Settings, Users } from "lucide-react";
import { getSession } from "@/lib/get-session";
import { canAccessReports, canManageDisplay, canManageGames, isManagerOrAbove } from "@/lib/permissions";
import { redirect } from "next/navigation";

export default async function AdminHomePage() {
  const session = await getSession();
  if (!session) redirect("/login?from=/admin");
  if (session.role === "EMPLOYEE" || session.role === "SHIFT_LEAD") redirect("/pos");

  const cards = [
    ...(canAccessReports(session) ? [{ href: "/admin/reports", title: "Reports", description: "Sales, audits, inventory, and performance", icon: BarChart3, tone: "bg-[#d92735]" }] : []),
    { href: "/admin/inventory", title: "Inventory", description: "Back stock, active packs, and live displays", icon: Boxes, tone: "bg-[#d41478]" },
    ...(canManageDisplay(session) ? [{ href: "/display-slots", title: "Displays", description: "Assign and monitor ticket displays", icon: Monitor, tone: "bg-[#6b46c1]" }] : []),
    ...(isManagerOrAbove(session) ? [{ href: "/settings/users", title: "Staff", description: "Users, roles, and permissions", icon: Users, tone: "bg-[#159447]" }] : []),
    ...(isManagerOrAbove(session) && canManageGames(session) ? [{ href: "/games", title: "Games", description: "Manage the store game catalogue", icon: Settings, tone: "bg-[#087da8]" }] : []),
    ...(isManagerOrAbove(session) ? [{ href: "/settings", title: "Settings", description: "Store controls and terminals", icon: Settings, tone: "bg-[#344563]" }] : []),
    ...(isManagerOrAbove(session) ? [{ href: "/admin/reconciliation", title: "Reconciliation", description: "Resolve offline POS sale conflicts", icon: RefreshCw, tone: "bg-[#087da8]" }] : []),
    ...(session.role === "OWNER" ? [{ href: "/admin/command-center", title: "COMMAND Center", description: "Centralized multi-store inventory and analytics", icon: BarChart3, tone: "bg-[#17233f]" }, { href: "/admin/billing", title: "Billing", description: "Plan, subscription, and invoices", icon: CreditCard, tone: "bg-[#087da8]" }] : []),
  ];

  return <main className="min-h-full px-5 py-6 sm:px-8 sm:py-8"><div className="mx-auto max-w-[1180px]"><header className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-[#087da8]">LottoOps Store Admin</p><h1 className="mt-2 text-3xl font-black tracking-tight text-[#17233f]">Management workspace</h1><p className="mt-2 text-sm text-slate-500">{session.storeName} · {session.name}</p></div><Link href="/" className="inline-flex min-h-11 items-center justify-center border-2 border-[#087da8] px-4 text-sm font-black text-[#087da8]">Back to Console</Link></header><section className="mt-7"><div className="mb-3 flex items-center gap-3"><h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Store oversight</h2><span className="h-px flex-1 bg-slate-200" /></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{cards.map(({ href, title, description, icon: Icon, tone }) => <Link key={href} href={href} className={`${tone} group flex min-h-[170px] flex-col justify-between border-2 border-white p-5 text-white shadow-[0_5px_0_rgba(23,35,63,0.12)] transition-transform hover:-translate-y-1 focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#17233f]`}><div className="flex items-start justify-between"><span className="flex h-14 w-14 items-center justify-center bg-white/20"><Icon size={31} /></span><span className="text-2xl font-black opacity-70">→</span></div><div><h3 className="text-2xl font-black">{title}</h3><p className="mt-1 text-sm font-medium text-white/85">{description}</p></div></Link>)}</div></section></div></main>;
}
