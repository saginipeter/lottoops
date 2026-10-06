import { ArrowRight, BarChart3, Boxes, ClipboardCheck, Gamepad2, MonitorSmartphone, Radio, ReceiptText, ShieldCheck, Store, TriangleAlert, Users, ShoppingCart } from "lucide-react";
import { Header } from "@/components/layout/header";
import { PageToolbar } from "@/components/ui/page-toolbar";
import { StatusBar } from "@/components/ui/status-bar";
import { getSession } from "@/lib/get-session";
import { prisma } from "@/lib/prisma";
import { LivePageRefresh } from "@/components/layout/live-page-refresh";
import { redirect } from "next/navigation";

interface ConsoleCard {
  href: string;
  title: string;
  description: string;
  status: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  tone: "accent" | "blue" | "green" | "amber";
}

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
      prisma.displaySlot.count({ where: { storeId: session.storeId, packId: { not: null } } }),
      prisma.pack.count({ where: { storeId: session.storeId, status: "BACK_STOCK" } }),
      prisma.shift.count({ where: { storeId: session.storeId, status: "OPEN" } }),
      prisma.game.count({ where: { storeId: session.storeId, active: true } }),
    ]);
    activeDisplayPacks = displayCount;
    backStockPacks = backStockCount;
    openShift = shiftCount > 0;
    activeGames = gamesCount;
  }

  const cards: ConsoleCard[] = [
    { href: "/pos", title: "Lottery POS", description: "Sell tickets from one touchscreen terminal", status: openShift ? "Open POS terminal" : "Open a shift first", icon: ShoppingCart, tone: openShift ? "green" : "amber" },
    { href: "/shifts", title: "Shift Control", description: "Open shift, opening audit, closing audit", status: openShift ? "Shift open" : "No shift open", icon: ClipboardCheck, tone: openShift ? "green" : "amber" },
    { href: "/inventory/live-scan", title: "Live Scan", description: "Scan sold tickets and monitor current packs", status: "Ready to scan", icon: Radio, tone: "accent" },
    { href: "/inventory/receive", title: "Receive Shipment", description: "Scan packs, capture photos, confirm inventory", status: "Receive packs", icon: ReceiptText, tone: "blue" },
    { href: "/display-slots", title: "Displays", description: "Assign packs and manage store displays", status: `${activeDisplayPacks} active displays`, icon: MonitorSmartphone, tone: "accent" },
    { href: "/inventory", title: "Active Stock & Back Stock", description: "Activate packs, correct tickets, and manage stock", status: `${backStockPacks} packs in back stock`, icon: Boxes, tone: "green" },
    { href: "/games", title: "Games Catalog", description: "Manage games, prices, and ticket quantities", status: `${activeGames} active games`, icon: Gamepad2, tone: "blue" },
    { href: "/reports", title: "Reports", description: "Review sales, audits, activity, and shifts", status: "Management reports", icon: BarChart3, tone: "amber" },
    { href: "/settings", title: "Staff & Settings", description: "Manage staff access and store controls", status: "Security controls", icon: Users, tone: "accent" },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <LivePageRefresh intervalMs={3000} />
      <Header title="Store Operations Console" subtitle="Touch a function to begin" />
      <PageToolbar
        left={<span className="flex items-center gap-2 text-xs text-text-secondary"><Store size={14} className="text-accent" />{session?.storeName ?? "LottoOps Store"}</span>}
        center={<span className="hidden sm:inline">All core operations · Touchscreen mode</span>}
        right={<span className={openShift ? "font-semibold text-success-soft-text" : "font-semibold text-warning-soft-text"}>{openShift ? "Shift open" : "No open shift"}</span>}
      />

      {session?.role === "SHIFT_LEAD" && (
        <div className="mx-4 mt-3 flex items-start gap-3 border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:mx-5">
          <TriangleAlert size={18} className="mt-0.5 shrink-0" />
          <div><p className="font-semibold">Manager or Owner action required</p><p className="mt-1 text-xs text-amber-800">Some shipment, sequence, returns, and account actions require approval.</p></div>
        </div>
      )}

      <main className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">
        <section className="mx-auto w-full max-w-[1500px]">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-tertiary">Main menu</p>
              <h1 className="mt-1 text-xl font-bold tracking-tight text-text sm:text-2xl">What would you like to do?</h1>
            </div>
            <div className="hidden items-center gap-2 text-xs text-text-secondary sm:flex"><ShieldCheck size={15} className="text-success" /> Protected operations</div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
            {cards.map((card) => <ConsoleCardLink key={card.title} card={card} />)}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="Shift" value={openShift ? "Open" : "Closed"} tone={openShift ? "good" : "warn"} />
            <Metric label="Displays" value={String(activeDisplayPacks)} />
            <Metric label="Back stock" value={String(backStockPacks)} />
            <Metric label="Active games" value={String(activeGames)} />
          </div>
        </section>
      </main>
      <StatusBar left={<span>Touch a card to open a workspace</span>} center={<span>Displays <strong>{activeDisplayPacks}</strong> <span className="mx-1 text-border">|</span> Back stock <strong>{backStockPacks}</strong></span>} right={<span className={openShift ? "text-success-soft-text" : "text-warning-soft-text"}>{openShift ? "Operations in progress" : "Open shift to begin"}</span>} />
    </div>
  );
}

function ConsoleCardLink({ card }: { card: ConsoleCard }) {
  const Icon = card.icon;
  const toneClasses = {
    accent: "border-accent/30 bg-accent-soft text-accent",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
  }[card.tone];
  return <a href={card.href} className="group card-surface card-interactive flex min-h-[150px] flex-col justify-between p-4 transition-colors hover:border-accent/60 hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-accent active:scale-[0.98] sm:min-h-[170px] sm:p-5">
    <div className="flex items-start justify-between gap-3"><span className={`flex h-12 w-12 items-center justify-center border sm:h-14 sm:w-14 ${toneClasses}`}><Icon size={25} /></span><ArrowRight size={21} className="mt-1 text-text-tertiary transition-transform group-hover:translate-x-1 group-hover:text-accent" /></div>
    <div className="mt-4"><h2 className="text-base font-bold text-text sm:text-lg">{card.title}</h2><p className="mt-1 line-clamp-2 text-xs leading-relaxed text-text-secondary sm:text-sm">{card.description}</p><p className="mt-3 text-[10px] font-bold uppercase tracking-[0.12em] text-text-tertiary">{card.status}</p></div>
  </a>;
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "good" | "warn" }) {
  return <div className="border border-border bg-surface px-3 py-3 sm:px-4"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-tertiary">{label}</p><p className={`mt-1 text-lg font-bold sm:text-xl ${tone === "good" ? "text-success-soft-text" : tone === "warn" ? "text-warning-soft-text" : "text-text"}`}>{value}</p></div>;
}
