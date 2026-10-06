import { ArrowRight, BarChart3, Boxes, ClipboardCheck, MonitorSmartphone, Radio, ReceiptText, ShieldCheck, Store, TriangleAlert, Users, ShoppingCart } from "lucide-react";
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
  tone: "cyan" | "yellow" | "green" | "pink" | "orange" | "red" | "blue" | "navy";
}

export default async function HomePage() {
  const session = await getSession();
  if (session?.role === "OWNER") redirect("/owner");
  const isEmployee = session?.role === "EMPLOYEE";

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

  const allCards: ConsoleCard[] = [
    { href: "/pos", title: "Sell Tickets", description: "Open the ticket selling screen", status: openShift ? "Ready for sales" : "Open a shift first", icon: ShoppingCart, tone: "cyan" },
    { href: "/inventory/live-scan?mode=pos", title: "Scan", description: "Scan a ticket or barcode", status: "Focused scanner", icon: Radio, tone: "yellow" },
    { href: "/inventory/receive", title: "Receive Stock", description: "Receive new scratch-ticket packs", status: "Invoice · Scan · Review · Confirm", icon: ReceiptText, tone: "green" },
    { href: "/inventory", title: "Inventory", description: "View active stock and back stock", status: `${backStockPacks} packs in back stock`, icon: Boxes, tone: "pink" },
    { href: "/shifts", title: "Shift", description: "Open, manage, or close the current shift", status: openShift ? "Shift open" : "No shift open", icon: ClipboardCheck, tone: "orange" },
    { href: "/reports", title: "Reports", description: "View sales, audits, and shift information", status: "Management reports", icon: BarChart3, tone: "red" },
    { href: "/display-slots", title: "Displays", description: "Assign and manage ticket displays", status: `${activeDisplayPacks} active displays`, icon: MonitorSmartphone, tone: "blue" },
    { href: "/settings", title: "Settings", description: "System and store configuration", status: "Security controls", icon: Users, tone: "navy" },
  ];
  const cards = isEmployee
    ? allCards.filter((card) => ["Sell Tickets", "Scan", "Shift"].includes(card.title))
    : allCards;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <LivePageRefresh intervalMs={3000} />
      <Header title="LottoOps Store Console" subtitle="Touch a function to begin" />
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
              <h1 className="mt-1 text-xl font-bold tracking-tight text-text sm:text-2xl">Choose a LottoOps function</h1>
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
    cyan: "border-[#087da8] bg-[#079bd0] text-white",
    yellow: "border-[#d1a500] bg-[#f1c400] text-white",
    green: "border-[#087c20] bg-[#11a62b] text-white",
    pink: "border-[#b50067] bg-[#df087f] text-white",
    orange: "border-[#c75f00] bg-[#ed7b0a] text-white",
    red: "border-[#b50019] bg-[#e4142b] text-white",
    blue: "border-[#0d5794] bg-[#126fc0] text-white",
    navy: "border-[#123b73] bg-[#174f91] text-white",
  }[card.tone];
  const tileIcon = {
    cyan: "bg-white/20 text-white",
    yellow: "bg-white/20 text-white",
    green: "bg-white/20 text-white",
    pink: "bg-white/20 text-white",
    orange: "bg-white/20 text-white",
    red: "bg-white/20 text-white",
    blue: "bg-white/20 text-white",
    navy: "bg-white/20 text-white",
  }[card.tone];
  return <a href={card.href} className={`group flex min-h-[148px] flex-col justify-between border p-4 shadow-[0_2px_0_rgba(0,0,0,0.12)] transition-transform hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-accent active:scale-[0.98] sm:min-h-[172px] sm:p-5 ${toneClasses}`}>
    <div className="flex items-start justify-between gap-3"><span className={`flex h-12 w-12 items-center justify-center rounded-sm sm:h-14 sm:w-14 ${tileIcon}`}><Icon size={27} /></span><ArrowRight size={21} className="mt-1 text-white/70 transition-transform group-hover:translate-x-1 group-hover:text-white" /></div>
    <div className="mt-4"><h2 className="text-base font-bold leading-tight text-white sm:text-lg">{card.title}</h2><p className="mt-1 line-clamp-2 text-xs leading-relaxed text-white/80 sm:text-sm">{card.description}</p><p className="mt-3 text-[10px] font-bold uppercase tracking-[0.12em] text-white/75">{card.status}</p></div>
  </a>;
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "good" | "warn" }) {
  return <div className="border border-border bg-surface px-3 py-3 sm:px-4"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-tertiary">{label}</p><p className={`mt-1 text-lg font-bold sm:text-xl ${tone === "good" ? "text-success-soft-text" : tone === "warn" ? "text-warning-soft-text" : "text-text"}`}>{value}</p></div>;
}
