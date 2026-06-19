import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  RefreshCw,
  Play,
  Square,
  Layers,
  Package,
  Clock,
  BarChart3,
  History,
  Coins,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import {
  getGame,
  getBackStockPacks,
  getDisplaySlots,
  getSlotNumber,
  getTicketProgress,
  formatCurrency,
  formatTime,
  formatRelativeTime,
} from "@/lib/utils";
import {
  scanLog,
  currentShift,
  topSellersToday,
  profitSnapshot,
  todayMetrics,
} from "@/lib/mock-data";

const logDotTone: Record<string, string> = {
  received: "bg-accent",
  activated: "bg-accent",
  "sold-out": "bg-danger",
  "shift-open": "bg-warning",
  "shift-close": "bg-success",
  returned: "bg-text-tertiary",
};

const barTone = ["bg-accent", "bg-success", "bg-success", "bg-warning", "bg-text-tertiary"];

export default function DashboardHome() {
  const backStock = getBackStockPacks().slice(0, 3);
  const slots = getDisplaySlots();
  const maxSellerAmount = topSellersToday[0]?.amount ?? 1;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Header
        title="Dashboard overview"
        subtitle="Wed, June 17 2026 · 9:41 AM"
        actions={
          <>
            <Button variant="secondary">
              <RefreshCw size={13} />
              Sync
            </Button>
            <Button variant="success">
              <Play size={13} />
              Open shift
            </Button>
          </>
        }
      />

      <div className="flex-1 overflow-y-auto px-4 py-3.5">
        <div className="flex flex-col gap-3.5">
          {/* Shift banner */}
          <div className="flex items-center gap-4 rounded-lg border border-accent-hover bg-gradient-to-br from-sidebar to-accent-hover px-[18px] py-3.5">
            <div className="flex-1">
              <p className="text-[9px] uppercase tracking-wide text-white/45">
                Current shift
              </p>
              <p className="mt-0.5 flex items-center text-[15px] font-medium text-white">
                <span className="mr-[5px] inline-block h-2 w-2 rounded-full bg-[#5DCAA5] shadow-[0_0_0_2px_rgba(93,202,165,0.3)]" />
                {currentShift.label} — open since {formatTime(currentShift.openedAt)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[9px] uppercase tracking-wide text-white/45">
                Shift ID
              </p>
              <p className="mt-0.5 text-xs text-white/70">#{currentShift.id}</p>
            </div>
            <div className="text-right">
              <p className="text-[9px] uppercase tracking-wide text-white/45">
                Active lines
              </p>
              <p className="mt-0.5 text-base font-medium text-white">
                {currentShift.activeLines}
              </p>
            </div>
            <Button variant="danger">
              <Square size={13} />
              Close shift
            </Button>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-4 gap-2.5">
            <StatCard
              label="Today's sales"
              value={formatCurrency(todayMetrics.salesToday)}
              sub={`+${todayMetrics.salesChangePercent}% vs yesterday`}
              subIcon={TrendingUp}
              subTone="success"
            />
            <StatCard
              label="Tickets sold"
              value={String(todayMetrics.ticketsSold)}
              sub={`${todayMetrics.ticketsSinceLastHour} since last hour`}
              subIcon={TrendingUp}
              subTone="success"
            />
            <StatCard
              label="Active displays"
              value={String(todayMetrics.activeDisplays)}
              valueSuffix={`/ ${todayMetrics.totalSlots}`}
              sub={`${todayMetrics.soldOutCount} sold out · ${todayMetrics.emptySlots} empty`}
              subTone="danger"
            />
            <StatCard
              label="Back stock packs"
              value={String(getBackStockPacks().length)}
              sub="2 low-ticket games"
              subIcon={AlertTriangle}
              subTone="warning"
            />
          </div>

          {/* Active slots + Back stock / Shift snapshot */}
          <div className="grid grid-cols-2 gap-3.5">
            <Panel>
              <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                <Layers size={14} className="text-accent" />
                <span className="flex-1 text-xs font-medium text-text">
                  Active display slots
                </span>
                <Link href="/slots">
                  <Button size="sm">Manage ↗</Button>
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr>
                      {["Slot", "Game", "Price", "Remaining", "Progress", "Status"].map(
                        (h) => (
                          <th
                            key={h}
                            className="whitespace-nowrap border-b border-border px-2 py-1.5 text-left text-[9px] uppercase tracking-wide text-text-tertiary"
                          >
                            {h}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {slots.map((pack) => {
                      const game = getGame(pack.gameId);
                      if (!game) return null;
                      const progress = getTicketProgress(pack);
                      const isSoldOut = pack.status === "sold-out";
                      return (
                        <tr
                          key={pack.id}
                          className="hover:bg-surface-soft [&>td]:border-b [&>td]:border-border last:[&>td]:border-b-0"
                        >
                          <td className="px-2 py-[7px]">
                            <span className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-md bg-surface-soft text-[10px] font-medium text-text-secondary">
                              {getSlotNumber(pack)}
                            </span>
                          </td>
                          <td className="px-2 py-[7px]">
                            <span className="font-medium text-text">
                              #{game.gameNumber}
                            </span>{" "}
                            <span className="text-[10px] text-text-tertiary">
                              {game.name}
                            </span>
                          </td>
                          <td className="px-2 py-[7px] text-text-secondary">
                            {formatCurrency(game.price)}
                          </td>
                          <td className="px-2 py-[7px] font-mono tabular-nums text-text">
                            {String(pack.currentTicketNumber ?? 0).padStart(3, "0")}
                          </td>
                          <td className="px-2 py-[7px]">
                            <div className="h-1 w-[60px] overflow-hidden rounded-full bg-surface-soft">
                              <div
                                className={isSoldOut ? "h-full rounded-full bg-danger" : "h-full rounded-full bg-accent"}
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </td>
                          <td className="px-2 py-[7px]">
                            <StatusBadge status={pack.status} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>

            <div className="flex flex-col gap-3.5">
              <Panel>
                <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                  <Package size={14} className="text-accent-hover" />
                  <span className="flex-1 text-xs font-medium text-text">
                    Back stock — ready to activate
                  </span>
                  <Link href="/inventory/receive">
                    <Button size="sm">Receive ↗</Button>
                  </Link>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr>
                        {["Serial", "Game", "Price", "Tickets", ""].map((h) => (
                          <th
                            key={h}
                            className="whitespace-nowrap border-b border-border px-2 py-1.5 text-left text-[9px] uppercase tracking-wide text-text-tertiary"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {backStock.map((pack) => {
                        const game = getGame(pack.gameId);
                        if (!game) return null;
                        return (
                          <tr
                            key={pack.id}
                            className="hover:bg-surface-soft [&>td]:border-b [&>td]:border-border last:[&>td]:border-b-0"
                          >
                            <td className="px-2 py-[7px] font-mono text-[10px] text-text-tertiary">
                              {pack.serialNumber}
                            </td>
                            <td className="px-2 py-[7px] text-[11px] font-medium text-text">
                              {game.gameNumber} · {game.name}
                            </td>
                            <td className="px-2 py-[7px] text-text-secondary">
                              {formatCurrency(game.price)}
                            </td>
                            <td className="px-2 py-[7px] text-text">
                              {game.ticketsPerPack}
                            </td>
                            <td className="px-2 py-[7px]">
                              <Button variant="primary" size="sm">
                                Activate ↗
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Panel>

              <Panel>
                <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                  <Clock size={14} className="text-success" />
                  <span className="text-xs font-medium text-text">
                    Shift reconciliation snapshot
                  </span>
                </div>
                <div className="px-4 py-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-md bg-surface-soft px-2.5 py-2">
                      <p className="text-[9px] uppercase tracking-wide text-text-tertiary">
                        Lines completed
                      </p>
                      <p className="mt-0.5 text-lg font-medium text-text">
                        {currentShift.linesCompleted}{" "}
                        <span className="text-[11px] text-text-tertiary">
                          / {currentShift.activeLines}
                        </span>
                      </p>
                    </div>
                    <div className="rounded-md bg-surface-soft px-2.5 py-2">
                      <p className="text-[9px] uppercase tracking-wide text-text-tertiary">
                        Variance
                      </p>
                      <p className="mt-0.5 text-lg font-medium text-success">
                        {formatCurrency(currentShift.variance)}
                      </p>
                    </div>
                  </div>
                  <p className="mb-1.5 mt-2.5 text-[10px] text-text-tertiary">
                    Pending ending ticket entry
                  </p>
                  <div className="flex flex-col gap-1">
                    {currentShift.pendingLines.map((line) => (
                      <div
                        key={line.slotNumber}
                        className="flex justify-between rounded-[5px] bg-surface-soft px-2.5 py-1.5 text-[11px]"
                      >
                        <span className="text-text-secondary">
                          Slot {line.slotNumber} · {line.gameName}
                        </span>
                        <span className="font-medium text-warning">Awaiting</span>
                      </div>
                    ))}
                  </div>
                  <Button variant="primary" className="mt-2.5 w-full justify-center">
                    Enter ending tickets ↗
                  </Button>
                </div>
              </Panel>
            </div>
          </div>

          {/* Bottom row: top sellers, scan log, profit tracker */}
          <div className="grid grid-cols-3 gap-3.5">
            <Panel>
              <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                <BarChart3 size={14} className="text-warning" />
                <span className="text-xs font-medium text-text">
                  Top sellers today
                </span>
              </div>
              <div className="px-4 py-3">
                {topSellersToday.map((seller, i) => (
                  <div
                    key={seller.gameName}
                    className="flex items-center gap-2 py-[5px] text-[11px]"
                  >
                    <span className="w-[90px] flex-shrink-0 truncate text-text-secondary">
                      {seller.gameName}
                    </span>
                    <div className="h-[5px] flex-1 overflow-hidden rounded-full bg-surface-soft">
                      <div
                        className={`h-full rounded-full ${barTone[i % barTone.length]}`}
                        style={{
                          width: `${(seller.amount / maxSellerAmount) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="min-w-[36px] text-right font-medium text-text">
                      {formatCurrency(seller.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel>
              <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                <History size={14} className="text-accent-hover" />
                <span className="flex-1 text-xs font-medium text-text">
                  Scan log — recent activity
                </span>
                <Link
                  href="/reports"
                  className="flex items-center gap-1 text-[10px] text-text-tertiary hover:text-text"
                >
                  View all
                  <ArrowRight size={11} />
                </Link>
              </div>
              <div className="px-3.5 py-1">
                {scanLog.slice(0, 5).map((entry, i, arr) => (
                  <div
                    key={entry.id}
                    className={
                      i !== arr.length - 1
                        ? "flex items-start gap-2.5 border-b border-border py-2"
                        : "flex items-start gap-2.5 py-2"
                    }
                  >
                    <span
                      className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${logDotTone[entry.action]}`}
                    />
                    <div>
                      <p className="text-[11px] leading-snug text-text">
                        {entry.detail}
                        {entry.gameName && (
                          <span className="text-text-secondary">
                            {" "}
                            — {entry.gameName}
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 text-[10px] text-text-tertiary">
                        {formatTime(entry.timestamp)} · {entry.performedBy}
                        {" · "}
                        {formatRelativeTime(entry.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel>
              <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                <Coins size={14} className="text-success" />
                <span className="text-xs font-medium text-text">
                  Profit tracker — this week
                </span>
              </div>
              <div className="px-4 py-3">
                <div className="mb-2.5 flex flex-col gap-[7px]">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-text-secondary">Retail value sold</span>
                    <span className="font-medium text-text">
                      {formatCurrency(profitSnapshot.retailValueSold)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-text-secondary">Pack cost (commission)</span>
                    <span className="font-medium text-danger">
                      -{formatCurrency(profitSnapshot.packCost)}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-border pt-[7px] text-xs">
                    <span className="font-medium text-text">Net profit</span>
                    <span className="font-medium text-success">
                      {formatCurrency(profitSnapshot.netProfit)}
                    </span>
                  </div>
                </div>
                <div className="rounded-md bg-surface-soft px-2.5 py-2">
                  <p className="mb-1 text-[9px] uppercase tracking-wide text-text-tertiary">
                    Margin
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface">
                      <div
                        className="h-full rounded-full bg-success"
                        style={{ width: `${profitSnapshot.marginPercent}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-success">
                      {profitSnapshot.marginPercent}%
                    </span>
                  </div>
                </div>
                <Link href="/reports">
                  <Button variant="secondary" className="mt-2.5 w-full justify-center text-[11px]">
                    Full profit report ↗
                  </Button>
                </Link>
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}
