import Link from "next/link";
import { ArrowRight, BarChart3, Boxes, ClipboardCheck, Gamepad2, MonitorSmartphone, Radio, ReceiptText, ShieldCheck, Store, TriangleAlert } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Panel } from "@/components/ui/panel";
import { PageToolbar } from "@/components/ui/page-toolbar";
import { StatusBar } from "@/components/ui/status-bar";
import { getSession } from "@/lib/get-session";
import { prisma } from "@/lib/prisma";
import { LockedPacksPanel } from "@/components/owner/locked-packs-panel";
import { TicketReportsPanel } from "@/components/reports/ticket-reports-panel";
import { TicketReturnRequestsPanel } from "@/components/reports/ticket-return-requests-panel";
import { LivePageRefresh } from "@/components/layout/live-page-refresh";
import { redirect } from "next/navigation";

interface ActionCard { href: string; title: string; description: string; icon: React.ComponentType<{ size?: number; className?: string }>; }
const operationsCards: ActionCard[] = [
  { href: "/shifts", title: "Shift Control", description: "Open, monitor, and close shift audits with full ticket reconciliation.", icon: ClipboardCheck },
  { href: "/inventory/live-scan", title: "Live Scan", description: "Scan sales in real time and keep display inventory synchronized.", icon: Radio },
  { href: "/inventory/receive", title: "Receiving", description: "Run the full shipment receiving workflow with image proof.", icon: ReceiptText },
  { href: "/display-slots", title: "Displays", description: "Assign packs and keep display status accurate.", icon: MonitorSmartphone },
];
const managementCards: ActionCard[] = [
  { href: "/inventory", title: "Back Stock", description: "Track available packs and control activation.", icon: Boxes },
  { href: "/games", title: "Games Catalog", description: "Manage active store games from one workspace.", icon: Gamepad2 },
  { href: "/reports", title: "Reports", description: "Review sales, shifts, and operational trends.", icon: BarChart3 },
  { href: "/settings", title: "Security & Settings", description: "Control staff permissions and governance settings.", icon: ShieldCheck },
];

export default async function HomePage() {
  const session = await getSession();
  if (session?.role === "OWNER") redirect("/owner");
  if (session?.role === "EMPLOYEE") redirect("/inventory/live-scan");

  let activeDisplayPacks = 0; let backStockPacks = 0; let openShift = false; let activeGames = 0;
  if (session && prisma) {
    const [displayCount, backStockCount, shiftCount, gamesCount] = await Promise.all([
      prisma.displaySlot.count({ where: { storeId: session.storeId, packId: { not: null } } }),
      prisma.pack.count({ where: { storeId: session.storeId, status: "BACK_STOCK" } }),
      prisma.shift.count({ where: { storeId: session.storeId, status: "OPEN" } }),
      prisma.game.count({ where: { storeId: session.storeId, active: true } }),
    ]);
    activeDisplayPacks = displayCount; backStockPacks = backStockCount; openShift = shiftCount > 0; activeGames = gamesCount;
  }

  return <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
    <LivePageRefresh intervalMs={3000} />
    <Header title="Operations dashboard" subtitle="A focused view of today’s store work and control points" />
    <PageToolbar left={<span className="flex items-center gap-2 text-xs text-text-secondary"><Store size={14} className="text-accent" />{session?.storeName ?? "Unknown store"}</span>} center={<span>F2 Receive <span className="mx-1 text-border">|</span> F3 Search Pack <span className="mx-1 text-border">|</span> F4 Open Shift</span>} right={<span className={openShift ? "font-semibold text-success-soft-text" : "font-semibold text-warning-soft-text"}>{openShift ? "Shift open" : "No open shift"}</span>} />
    {session?.role === "SHIFT_LEAD" && <div className="mx-5 mt-4 flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"><TriangleAlert size={17} className="mt-0.5 shrink-0" /><div><p className="font-semibold">Manager or Owner action required</p><p className="mt-1 text-xs text-amber-800">Shipment overrides, sequence-lock reviews, ticket returns, and account or store changes require approval.</p></div></div>}
    <div className="flex-1 overflow-y-auto px-5 py-4">
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_330px]">
        <Panel className="overflow-hidden p-0"><div className="border-b border-border bg-surface-soft px-5 py-4"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-tertiary">Store control center</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-text">{session?.storeName ?? "LottoOps Store"}</h1></div><span className="inline-flex items-center gap-2 rounded-full border border-success/30 bg-success-soft px-3 py-1.5 text-xs font-semibold text-success-soft-text"><span className="h-2 w-2 rounded-full bg-success" />Records protected</span></div><p className="mt-3 max-w-2xl text-sm text-text-secondary">Keep the floor moving: reconcile the current shift, receive new packs, and resolve exceptions before they become inventory gaps.</p></div><div className="grid grid-cols-2 divide-x divide-border md:grid-cols-4"><MetricCell label="Shift status" value={openShift ? "Open" : "Closed"} tone={openShift ? "good" : "warn"} /><MetricCell label="Display packs" value={String(activeDisplayPacks)} /><MetricCell label="Back stock" value={String(backStockPacks)} /><MetricCell label="Active games" value={String(activeGames)} /></div></Panel>
        <Panel className="p-4"><div className="flex items-start justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-tertiary">Next best actions</p><h2 className="mt-1 text-base font-semibold text-text">Keep operations moving</h2></div><ClipboardCheck size={18} className="text-accent" /></div><div className="mt-3 space-y-1.5"><PriorityAction href="/inventory/receive" step="01" label="Receive shipment" detail="Scan incoming packs" /><PriorityAction href="/inventory/live-scan" step="02" label="Start live scan" detail="Keep ticket flow current" /><PriorityAction href="/display-slots" step="03" label="Review displays" detail={`${activeDisplayPacks} packs currently assigned`} /><PriorityAction href="/reports" step="04" label="Open reports" detail="Review today’s activity" /></div></Panel>
      </div>
      <LockedPacksPanel /><TicketReturnRequestsPanel title="Ticket Return Requests" /><TicketReportsPanel title="Employee Ticket Reports" />
      <ActionSection title="Core operations" eyebrow="High-frequency workflows" cards={operationsCards} />
      <ActionSection title="Management & governance" eyebrow="Store control and oversight" cards={managementCards} />
    </div>
    <StatusBar left={<span>Displays <strong>{activeDisplayPacks}</strong></span>} center={<span>Back stock <strong>{backStockPacks}</strong> <span className="mx-1 text-border">|</span> Active games <strong>{activeGames}</strong></span>} right={<span className={openShift ? "text-success-soft-text" : "text-warning-soft-text"}>{openShift ? "Operations in progress" : "Open shift to begin"}</span>} />
  </div>;
}

function MetricCell({ label, value, tone }: { label: string; value: string; tone?: "good" | "warn" }) { return <div className="px-5 py-4"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-tertiary">{label}</p><p className={`mt-1 text-xl font-semibold ${tone === "good" ? "text-success-soft-text" : tone === "warn" ? "text-warning-soft-text" : "text-text"}`}>{value}</p></div>; }
function PriorityAction({ href, step, label, detail }: { href: string; step: string; label: string; detail: string }) { return <Link href={href} className="group flex min-h-12 items-center gap-3 rounded-md border border-border bg-surface px-3 py-2 transition-colors hover:border-accent/40 hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-accent"><span className="font-mono text-[10px] text-text-tertiary">{step}</span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-text">{label}</span><span className="block truncate text-[11px] text-text-secondary">{detail}</span></span><ArrowRight size={15} className="text-text-tertiary transition-transform group-hover:translate-x-0.5 group-hover:text-accent" /></Link>; }
function ActionSection({ title, eyebrow, cards }: { title: string; eyebrow: string; cards: ActionCard[] }) { return <section className="mt-7"><div className="mb-3 flex items-end justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">{eyebrow}</p><h2 className="mt-1 text-base font-semibold text-text">{title}</h2></div><span className="text-xs text-text-tertiary">{cards.length} workspaces</span></div><div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">{cards.map((card) => <Panel key={card.title} className="card-interactive p-4"><div className="flex items-start justify-between gap-3"><div className="inline-flex rounded-md border border-accent/20 bg-accent-soft p-2 text-accent"><card.icon size={16} /></div><Link href={card.href} className="inline-flex min-h-9 items-center gap-1 text-xs font-semibold text-accent hover:underline">Open <ArrowRight size={12} /></Link></div><h3 className="mt-3 text-sm font-semibold text-text">{card.title}</h3><p className="mt-1 text-xs leading-relaxed text-text-secondary">{card.description}</p></Panel>)}</div></section>; }
