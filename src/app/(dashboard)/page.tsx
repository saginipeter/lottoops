import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  ClipboardCheck,
  Gamepad2,
  MonitorSmartphone,
  Radio,
  ReceiptText,
  ShieldCheck,
  Store,
} from "lucide-react";
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

interface ActionCard {
  href: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const operationsCards: ActionCard[] = [
  {
    href: "/shifts",
    title: "Shift Control",
    description: "Open, monitor, and close shift audits with full ticket reconciliation.",
    icon: ClipboardCheck,
  },
  {
    href: "/inventory/live-scan",
    title: "Live Scan",
    description: "Scan sales in real time and keep display inventory synchronized.",
    icon: Radio,
  },
  {
    href: "/inventory/receive",
    title: "Receiving",
    description: "Run the full 10-step shipment receiving workflow with image proof.",
    icon: ReceiptText,
  },
  {
    href: "/display-slots",
    title: "Displays",
    description: "Assign packs, monitor active stock, and keep display status accurate.",
    icon: MonitorSmartphone,
  },
];

const managementCards: ActionCard[] = [
  {
    href: "/inventory",
    title: "Back Stock",
    description: "Track available packs, remove/reassign with reasons, and control activation.",
    icon: Boxes,
  },
  {
    href: "/games",
    title: "Games Catalog",
    description: "Manage store games and Texas Lottery sync catalog from one workspace.",
    icon: Gamepad2,
  },
  {
    href: "/reports",
    title: "Reports",
    description: "Review sales totals, shift summaries, and operational performance trends.",
    icon: BarChart3,
  },
  {
    href: "/settings",
    title: "Security & Settings",
    description: "Control staff permissions, approval PIN, and enterprise governance settings.",
    icon: ShieldCheck,
  },
];

export default async function HomePage() {
  const session = await getSession();

  if (session?.role === "OWNER") redirect("/owner");
  if (session?.role === "EMPLOYEE") redirect("/inventory/live-scan");

  let activeDisplayPacks = 0;
  let backStockPacks = 0;
  let openShift = false;
  let activeGames = 0;

  if (session && prisma) {
    const [displayCount, backStockCount, shiftCount, gamesCount] = await Promise.all([
      prisma.displaySlot.count({
        where: { storeId: session.storeId, packId: { not: null } },
      }),
      prisma.pack.count({
        where: { storeId: session.storeId, status: "BACK_STOCK" },
      }),
      prisma.shift.count({
        where: { storeId: session.storeId, status: "OPEN" },
      }),
      prisma.game.count({
        where: { storeId: session.storeId, active: true },
      }),
    ]);

    activeDisplayPacks = displayCount;
    backStockPacks = backStockCount;
    openShift = shiftCount > 0;
    activeGames = gamesCount;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <LivePageRefresh intervalMs={3000} />

      <Header
        title="Enterprise Operations Center"
        subtitle="Unified control for lottery inventory, sales, and compliance"
      />

      <PageToolbar
        left={<span className="text-xs text-text-secondary">Store: {session?.storeName ?? "Unknown"}</span>}
        center={<span>F2 Receive | F3 Search Pack | F4 Open Shift</span>}
        right={<span className="text-xs text-text-tertiary">{openShift ? "Shift Open" : "No Open Shift"}</span>}
      />

      {session?.role === "SHIFT_LEAD" && (
        <div className="mx-5 mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">Manager or Owner action required</p>
          <p className="mt-1 text-xs text-amber-800">
            Shipment overrides, sequence-lock reviews, customer ticket returns, and account or store changes require Manager or Owner approval.
          </p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-5 py-5">
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <Panel className="xl:col-span-2 p-6">
            <p className="text-xs uppercase tracking-wide text-text-tertiary">Store Overview</p>
            <div className="mt-2 flex items-center gap-2">
              <Store size={18} className="text-accent" />
              <h2 className="text-xl font-semibold text-text">{session?.storeName ?? "LottoOps Store"}</h2>
            </div>
            <p className="mt-2 text-sm text-text-secondary">
              Centralized operations dashboard for receiving, display control, live sales scanning, and shift audits.
            </p>

            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
              <MetricCard label="Open Shift" value={openShift ? "Yes" : "No"} />
              <MetricCard label="Active Display Packs" value={String(activeDisplayPacks)} />
              <MetricCard label="Back Stock Packs" value={String(backStockPacks)} />
              <MetricCard label="Active Games" value={String(activeGames)} />
            </div>
          </Panel>

          <Panel className="p-6">
            <p className="text-xs uppercase tracking-wide text-text-tertiary">Priority Actions</p>
            <div className="mt-3 space-y-2">
              <QuickAction href="/inventory/receive" label="Start receiving shipment" />
              <QuickAction href="/inventory/live-scan" label="Start live scan mode" />
              <QuickAction href="/display-slots" label="Review display status" />
              <QuickAction href="/reports" label="Open daily reports" />
            </div>
          </Panel>
        </div>

        <LockedPacksPanel />
        <TicketReturnRequestsPanel title="Ticket Return Requests" />
        <TicketReportsPanel title="Employee Ticket Reports" />

        <Section title="Core Operations" cards={operationsCards} />
        <Section title="Management & Governance" cards={managementCards} />
      </div>

      <StatusBar
        left={<span>Active Display Packs: {activeDisplayPacks}</span>}
        center={<span>Back Stock: {backStockPacks} | Active Games: {activeGames}</span>}
        right={<span>{openShift ? "Operations in Progress" : "Open shift to begin"}</span>}
      />
    </div>
  );
}

function Section({ title, cards }: { title: string; cards: ActionCard[] }) {
  return (
    <div className="mt-6">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-tertiary">{title}</h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Panel key={card.title} className="card-interactive p-5">
            <div className="flex items-start justify-between">
              <div className="inline-flex rounded-lg border border-border bg-surface-soft p-2 text-accent">
                <card.icon size={16} />
              </div>
              <Link
                href={card.href}
                className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
              >
                Open
                <ArrowRight size={12} />
              </Link>
            </div>
            <h4 className="mt-3 text-base font-semibold text-text">{card.title}</h4>
            <p className="mt-1 text-sm leading-relaxed text-text-secondary">{card.description}</p>
          </Panel>
        ))}
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card-surface rounded-lg px-3 py-2.5">
      <p className="text-[11px] uppercase tracking-wide text-text-tertiary">{label}</p>
      <p className="mt-1 text-lg font-semibold text-text">{value}</p>
    </div>
  );
}

function QuickAction({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="card-surface card-interactive flex items-center justify-between rounded-md px-3 py-2 text-sm text-text"
    >
      <span>{label}</span>
      <ArrowRight size={14} className="text-text-tertiary" />
    </Link>
  );
}