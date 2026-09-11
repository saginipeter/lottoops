"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Maximize2, Minimize2, RefreshCw, Tv, ShieldCheck, CircleAlert } from "lucide-react";

type TvDisplaySlot = {
  id: string;
  slotNumber: string;
  gameName: string;
  gameNumber: string;
  gameImage?: string | null;
  ticketPrice: number;
  firstTicket: number;
  currentTicket: number;
  nextTicket: number;
  remaining: number;
  sold: number;
  quantity: number;
};

interface TvDisplayBoardProps {
  slots: TvDisplaySlot[];
  kioskMode: boolean;
  refreshSeconds: number;
}

export function TvDisplayBoard({ slots, kioskMode, refreshSeconds }: TvDisplayBoardProps) {
  const router = useRouter();
  const [lastRefreshAt, setLastRefreshAt] = useState<Date>(new Date());
  const [now, setNow] = useState<Date>(new Date());
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    const refresh = setInterval(() => void refreshBoard(), refreshSeconds * 1000);
    return () => clearInterval(refresh);
  }, [refreshSeconds]);

  useEffect(() => {
    const watchdog = setInterval(() => {
      setStale(Date.now() - lastRefreshAt.getTime() > refreshSeconds * 2000);
    }, 1000);
    return () => clearInterval(watchdog);
  }, [lastRefreshAt, refreshSeconds]);

  function refreshBoard() {
    setRefreshing(true);
    router.refresh();
    window.setTimeout(() => {
      setLastRefreshAt(new Date());
      setStale(false);
      setRefreshing(false);
    }, 600);
  }

  const summary = useMemo(() => ({
    totalRemaining: slots.reduce((sum, slot) => sum + slot.remaining, 0),
    totalSold: slots.reduce((sum, slot) => sum + slot.sold, 0),
  }), [slots]);

  const boardShell = kioskMode
    ? "min-h-screen bg-[#17233f] p-7 text-white"
    : "border border-[#31415f] bg-[#17233f] p-7 text-white";
  const statusLabel = stale ? "Updates delayed" : refreshing ? "Updating" : "Live and verified";
  const statusClass = stale ? "text-[#f6c86b]" : refreshing ? "text-[#c8d4ed]" : "text-[#8fe3c1]";

  return (
    <div className={boardShell}>
      <header className="mb-6 flex items-start justify-between gap-5 border-b border-white/15 pb-5">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center border border-[#b85eaa66] bg-[#a33d9a26] text-[#e58bd9]"><Tv size={20} /></div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/55">Customer-facing display</p>
              <h2 className="mt-1 text-3xl font-semibold tracking-tight">Scratch-Off Ticket Board</h2>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/65">
            <span>Updated every {refreshSeconds}s</span>
            <span className={`inline-flex items-center gap-2 font-semibold ${statusClass}`}>
              <span className={`h-2 w-2 ${stale ? "bg-[#f6c86b]" : refreshing ? "bg-[#c8d4ed]" : "bg-[#8fe3c1]"}`} />
              {statusLabel}
            </span>
            <span>Last verified {lastRefreshAt.toLocaleTimeString()}</span>
          </div>
        </div>
        <div className="flex shrink-0 items-start gap-3">
          <div className="border border-white/15 bg-white/10 px-4 py-2 text-right">
            <div className="text-[10px] uppercase tracking-[0.16em] text-white/55">Store time</div>
            <div className="mt-1 text-lg font-semibold tabular-nums">{now.toLocaleTimeString()}</div>
          </div>
          {!kioskMode && <button type="button" onClick={refreshBoard} disabled={refreshing} className="inline-flex min-h-11 items-center gap-2 border border-white/20 bg-white/10 px-4 text-sm font-semibold hover:bg-white/20 disabled:opacity-60"><RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />Update</button>}
          <Link href={kioskMode ? "/settings/tv-display" : "/settings/tv-display?kiosk=1"} className="inline-flex min-h-11 items-center gap-2 border border-white/20 bg-white/10 px-4 text-sm font-semibold hover:bg-white/20">{kioskMode ? <Minimize2 size={16} /> : <Maximize2 size={16} />}{kioskMode ? "Exit" : "Fullscreen"}</Link>
        </div>
      </header>

      <div className="mb-6 grid grid-cols-3 gap-3">
        <Summary label="Active displays" value={slots.length} />
        <Summary label="Tickets remaining" value={summary.totalRemaining} />
        <Summary label="Tickets sold this shift" value={summary.totalSold} />
      </div>

      {stale && <div className="mb-5 flex items-center gap-3 border border-[#8a641d] bg-[#473716] px-4 py-3 text-sm text-[#ffe1a0]"><CircleAlert size={18} /><span><strong>Updates delayed.</strong> Showing the last verified ticket status. Check the retailer terminal for current information.</span></div>}

      {slots.length === 0 ? (
        <div className="border border-white/20 bg-white/5 p-12 text-center">
          <RefreshCw size={26} className="mx-auto mb-4 text-[#e58bd9]" />
          <p className="text-xl font-semibold">No active displays</p>
          <p className="mt-2 text-sm text-white/65">Assign active packs to display slots to populate this board.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {slots.map((slot) => <DisplayCard key={slot.id} slot={slot} broken={brokenImages[slot.id]} onBroken={() => setBrokenImages((prev) => ({ ...prev, [slot.id]: true }))} />)}
        </div>
      )}

      <footer className="mt-6 flex items-center justify-between gap-4 border-t border-white/15 pt-4 text-xs text-white/60">
        <span className="inline-flex items-center gap-2"><ShieldCheck size={14} className="text-[#8fe3c1]" />Ticket numbers shown for checking only</span>
        <span>Validate tickets at the retailer terminal</span>
      </footer>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return <div className="border border-white/15 bg-white/10 px-5 py-4"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/55">{label}</p><p className="mt-2 text-3xl font-semibold tabular-nums text-white">{value}</p></div>;
}

function DisplayCard({ slot, broken, onBroken }: { slot: TvDisplaySlot; broken?: boolean; onBroken: () => void }) {
  const progress = slot.quantity > 0 ? Math.max((slot.sold / slot.quantity) * 100, 0) : 0;
  return <article className="border border-white/15 bg-white/10 p-5 text-white">
    <div className="flex items-center justify-between gap-3 border-b border-white/15 pb-3"><span className="border border-[#8fe3c166] bg-[#8fe3c11a] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#8fe3c1]">Display {slot.slotNumber}</span><span className="text-sm text-white/60">Game #{slot.gameNumber}</span></div>
    <div className="mt-4 flex items-center gap-4">
      {slot.gameImage && !broken ? <img src={slot.gameImage} alt="" className="h-16 w-16 border border-white/20 bg-white/10 object-cover" onError={onBroken} /> : <div className="flex h-16 w-16 items-center justify-center border border-white/20 bg-white/10 text-2xl font-semibold text-[#e58bd9]">{slot.gameName.slice(0, 1).toUpperCase()}</div>}
      <div><h3 className="text-2xl font-semibold leading-tight">{slot.gameName}</h3><p className="mt-1 text-sm text-white/60">${slot.ticketPrice.toFixed(2)} per ticket</p></div>
    </div>
    <div className="mt-5 border border-[#b85eaa66] bg-[#241b4d] px-4 py-3"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/55">Next ticket to process</p><p className="mt-1 text-4xl font-semibold tabular-nums tracking-wide text-white">{slot.nextTicket}</p><p className="mt-1 text-xs text-white/55">Current ticket {slot.currentTicket}</p></div>
    <div className="mt-4 grid grid-cols-2 gap-2 text-sm"><DataPoint label="Remaining" value={slot.remaining} /><DataPoint label="Sold" value={slot.sold} /></div>
    <div className="mt-4"><div className="mb-1 flex justify-between text-xs text-white/65"><span>Pack progress</span><span>{progress.toFixed(0)}%</span></div><div className="h-2 bg-white/15"><div className="h-2 bg-[#e58bd9]" style={{ width: `${Math.min(progress, 100)}%` }} /></div></div>
  </article>;
}

function DataPoint({ label, value }: { label: string; value: number }) {
  return <div className="border border-white/10 bg-white/5 px-3 py-2"><span className="block text-[10px] uppercase tracking-wider text-white/50">{label}</span><strong className="mt-1 block text-lg tabular-nums">{value}</strong></div>;
}
