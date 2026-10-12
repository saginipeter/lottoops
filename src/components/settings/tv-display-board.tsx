"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Maximize2, Minimize2, RefreshCw, Tv, ShieldCheck, CircleAlert } from "lucide-react";

type TvDisplaySlot = {
  id: string;
  packId: string;
  slotNumber: string;
  gameName: string;
  gameNumber: string;
  gameImage?: string | null;
  ticketPrice: number;
  sellDirection: "FIRST" | "LAST";
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
  kioskToken?: string;
}

export function TvDisplayBoard({ slots, kioskMode, refreshSeconds, kioskToken }: TvDisplayBoardProps) {
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

  const refreshBoard = useCallback(() => {
    setRefreshing(true);
    router.refresh();
    window.setTimeout(() => {
      setLastRefreshAt(new Date());
      setStale(false);
      setRefreshing(false);
    }, 600);
  }, [router]);

  useEffect(() => {
    const refresh = setInterval(() => void refreshBoard(), refreshSeconds * 1000);
    return () => clearInterval(refresh);
  }, [refreshBoard, refreshSeconds]);

  useEffect(() => {
    const watchdog = setInterval(() => setStale(Date.now() - lastRefreshAt.getTime() > refreshSeconds * 2000), 1000);
    return () => clearInterval(watchdog);
  }, [lastRefreshAt, refreshSeconds]);

  const statusLabel = stale ? "Updates delayed" : refreshing ? "Updating" : "Live display";
  const statusClass = stale ? "text-amber-300" : refreshing ? "text-slate-300" : "text-emerald-300";
  const shellClass = kioskMode
    ? "flex h-screen min-h-0 flex-col overflow-hidden bg-[#080c18] p-3 text-white sm:p-5 lg:p-7"
    : "border border-[#31415f] bg-[#080c18] p-4 text-white sm:p-6";

  return (
    <div className={shellClass}>
      <header className="mb-3 flex items-center justify-between gap-3 border-b border-white/15 pb-3 sm:mb-5 sm:pb-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="hidden h-10 w-10 items-center justify-center border border-fuchsia-300/40 bg-fuchsia-400/15 text-fuchsia-200 sm:flex"><Tv size={20} /></div>
          <div className="min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-fuchsia-200/80 sm:text-[10px]">LottoOps customer display</p>
            <h2 className="truncate text-xl font-bold tracking-tight sm:text-3xl">Scratch-Off Games</h2>
          </div>
          <span className={`hidden items-center gap-2 text-xs font-bold uppercase tracking-wider sm:inline-flex ${statusClass}`}><span className={`h-2 w-2 ${stale ? "bg-amber-300" : refreshing ? "bg-slate-300" : "bg-emerald-300"}`} />{statusLabel}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="hidden text-right sm:block"><div className="text-[9px] uppercase tracking-[0.16em] text-white/45">Store time</div><div className="text-lg font-bold tabular-nums">{now.toLocaleTimeString()}</div></div>
          {!kioskMode && <button type="button" onClick={refreshBoard} disabled={refreshing} className="inline-flex min-h-10 items-center gap-2 border border-white/20 bg-white/10 px-3 text-xs font-bold uppercase tracking-wider hover:bg-white/20 disabled:opacity-60"><RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />Update</button>}
          <Link href={kioskMode ? "/settings/tv-display" : "/settings/tv-display?kiosk=1"} className="inline-flex min-h-10 items-center gap-2 border border-fuchsia-200/30 bg-fuchsia-400/15 px-3 text-xs font-bold uppercase tracking-wider text-fuchsia-100 hover:bg-fuchsia-400/25">{kioskMode ? <Minimize2 size={15} /> : <Maximize2 size={15} />}{kioskMode ? "Exit" : "Full screen"}</Link>
        </div>
      </header>

      <div className="mb-3 sm:mb-5">
        <Summary label="Games on display" value={slots.length} />
      </div>

      {stale && <div className="mb-3 flex items-center gap-2 border border-amber-400/50 bg-amber-300/10 px-3 py-2 text-xs text-amber-100 sm:mb-4"><CircleAlert size={15} /><span><strong>Updates delayed.</strong> Showing the last verified board.</span></div>}

      {slots.length === 0 ? (
        <div className="border border-white/20 bg-white/5 p-10 text-center"><RefreshCw size={26} className="mx-auto mb-4 text-fuchsia-200" /><p className="text-xl font-bold">No games on display</p><p className="mt-2 text-sm text-white/60">Assign active packs to displays to populate this board.</p></div>
      ) : (
        <div className={kioskMode ? "grid min-h-0 flex-1 gap-2 overflow-hidden sm:gap-3" : "grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5 2xl:grid-cols-7"} style={kioskMode ? { gridTemplateColumns: `repeat(${Math.min(Math.max(Math.ceil(Math.sqrt(slots.length * 1.5)), 1), 7)}, minmax(0, 1fr))`, gridAutoRows: "minmax(0, 1fr)" } : undefined}>
          {slots.map((slot) => <DisplayCard key={slot.id} slot={slot} kioskMode={kioskMode} kioskToken={kioskToken} broken={brokenImages[slot.id]} onBroken={() => setBrokenImages((prev) => ({ ...prev, [slot.id]: true }))} />)}
        </div>
      )}

      <footer className="mt-4 flex items-center justify-between gap-3 border-t border-white/15 pt-3 text-[10px] uppercase tracking-wider text-white/45 sm:mt-5"><span className="inline-flex items-center gap-2"><ShieldCheck size={13} className="text-emerald-300" />Live inventory board</span><span>Updated every {refreshSeconds}s</span></footer>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return <div className="border border-white/15 bg-white/10 px-2 py-2 sm:px-4 sm:py-3"><p className="truncate text-[8px] font-bold uppercase tracking-[0.13em] text-white/50 sm:text-[10px]">{label}</p><p className="mt-1 text-xl font-bold tabular-nums sm:text-2xl">{value}</p></div>;
}

function DisplayCard({ slot, kioskMode, kioskToken, broken, onBroken }: { slot: TvDisplaySlot; kioskMode: boolean; kioskToken?: string; broken?: boolean; onBroken: () => void }) {
  const progress = slot.quantity > 0 ? Math.max((slot.sold / slot.quantity) * 100, 0) : 0;
  const imageSrc = slot.gameImage && kioskToken ? `${slot.gameImage}?token=${encodeURIComponent(kioskToken)}` : slot.gameImage;
  return <article className={`group relative flex min-h-0 flex-col overflow-hidden border border-white/20 bg-[#151d31] shadow-[0_3px_0_rgba(0,0,0,0.35)] ${kioskMode ? "text-[0.85em]" : ""}`}>
    <div className={`relative min-h-0 overflow-hidden bg-white ${kioskMode ? "flex-1" : "aspect-[1.15]"}`}>
      {imageSrc && !broken ? <Image src={imageSrc} alt={`${slot.gameName} ticket pack`} fill unoptimized className="object-contain p-1 transition-transform duration-300 group-hover:scale-[1.02]" onError={onBroken} /> : <div className="flex h-full items-center justify-center bg-[#f1f4f8] text-4xl font-black text-[#53627a]">{slot.gameName.slice(0, 1).toUpperCase()}</div>}
      <div className="absolute left-1 top-1 bg-black/75 px-1.5 py-1 text-[8px] font-bold uppercase text-white sm:left-2 sm:top-2 sm:text-[10px]">Display {slot.slotNumber}</div>
    </div>
    <div className="shrink-0 border-t-2 border-[#182236] bg-white text-[#101828]">
      <div className="flex items-center justify-between gap-2 border-b border-[#d6dce5] px-2 py-1 sm:px-3">
        <div className="min-w-0"><h3 className="truncate text-[10px] font-black leading-tight sm:text-sm">{slot.gameName}</h3><p className="truncate text-[8px] font-semibold uppercase text-[#667085] sm:text-[9px]">Game {slot.gameNumber} · ${slot.ticketPrice.toFixed(0)}</p></div>
        <span className={`shrink-0 px-1.5 py-1 text-[7px] font-black uppercase sm:text-[8px] ${slot.sellDirection === "LAST" ? "bg-[#fff0db] text-[#8a4b08]" : "bg-[#e7f4ed] text-[#17633b]"}`}>Sell {slot.sellDirection === "LAST" ? "Last" : "First"}</span>
      </div>
      <div className="grid grid-cols-2">
        <div className="flex items-center justify-between gap-1 border-r border-[#d6dce5] px-2 py-1.5 sm:px-3 sm:py-2"><span className="text-[7px] font-black uppercase tracking-wide text-[#667085] sm:text-[9px]">Current</span><strong className="text-lg font-black leading-none tabular-nums text-[#c62828] sm:text-2xl">{slot.currentTicket}</strong></div>
        <div className="flex items-center justify-between gap-1 px-2 py-1.5 sm:px-3 sm:py-2"><span className="text-[7px] font-black uppercase tracking-wide text-[#667085] sm:text-[9px]">Next</span><strong className="text-lg font-black leading-none tabular-nums text-[#17233f] sm:text-2xl">{slot.nextTicket > 0 ? slot.nextTicket : "—"}</strong></div>
      </div>
    </div>
    {!kioskMode && <div className="h-1 bg-white/10"><div className="h-1 bg-fuchsia-300" style={{ width: `${Math.min(progress, 100)}%` }} /></div>}
  </article>;
}
