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
    ? "flex h-screen min-h-0 flex-col overflow-hidden bg-[#062f3a] p-2 text-white sm:p-3 lg:p-4"
    : "border border-[#0d82a6] bg-[#062f3a] p-3 text-white sm:p-5";

  return (
    <div className={shellClass}>
      <header className="mb-2 flex items-center justify-between gap-3 border-2 border-[#16d5d8] bg-[#087d8a] px-3 py-2 shadow-[0_3px_0_#02262e] sm:mb-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="hidden h-9 w-9 items-center justify-center border border-white/50 bg-white/15 text-white sm:flex"><Tv size={19} /></div>
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[0.22em] text-white/75 sm:text-[10px]">LottoOps customer display</p>
            <h2 className="truncate text-lg font-black uppercase tracking-tight sm:text-2xl">Scratch-Off Games</h2>
          </div>
          <span className={`hidden items-center gap-2 text-xs font-bold uppercase tracking-wider sm:inline-flex ${statusClass}`}><span className={`h-2 w-2 ${stale ? "bg-amber-300" : refreshing ? "bg-slate-300" : "bg-emerald-300"}`} />{statusLabel}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="hidden text-right sm:block"><div className="text-[9px] uppercase tracking-[0.16em] text-white/65">Store time</div><div className="text-lg font-black tabular-nums">{now.toLocaleTimeString()}</div></div>
          {!kioskMode && <button type="button" onClick={refreshBoard} disabled={refreshing} className="inline-flex min-h-9 items-center gap-2 border border-white/40 bg-white/10 px-3 text-xs font-bold uppercase tracking-wider hover:bg-white/20 disabled:opacity-60"><RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />Update</button>}
          <Link href={kioskMode ? "/settings/tv-display" : "/settings/tv-display?kiosk=1"} className="inline-flex min-h-9 items-center gap-2 border border-white/45 bg-white/10 px-3 text-xs font-bold uppercase tracking-wider text-white hover:bg-white/20">{kioskMode ? <Minimize2 size={15} /> : <Maximize2 size={15} />}{kioskMode ? "Exit" : "Full screen"}</Link>
        </div>
      </header>

      <div className="mb-2 sm:mb-3">
        <Summary label="Games on display" value={slots.length} />
      </div>

      {stale && <div className="mb-3 flex items-center gap-2 border border-amber-400/50 bg-amber-300/10 px-3 py-2 text-xs text-amber-100 sm:mb-4"><CircleAlert size={15} /><span><strong>Updates delayed.</strong> Showing the last verified board.</span></div>}

      {slots.length === 0 ? (
        <div className="border border-white/20 bg-white/5 p-10 text-center"><RefreshCw size={26} className="mx-auto mb-4 text-fuchsia-200" /><p className="text-xl font-bold">No games on display</p><p className="mt-2 text-sm text-white/60">Assign active packs to displays to populate this board.</p></div>
      ) : (
        <div className={`${kioskMode ? "grid min-h-0 flex-1 gap-1 overflow-hidden sm:gap-2" : "grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5 2xl:grid-cols-7"} border-2 border-[#16d5d8] bg-[#16d5d8] p-1 shadow-[0_4px_0_#02262e] sm:p-2`} style={kioskMode ? { gridTemplateColumns: `repeat(${Math.min(Math.max(Math.ceil(Math.sqrt(slots.length * 1.55)), 1), 8)}, minmax(0, 1fr))`, gridAutoRows: "minmax(0, 1fr)" } : undefined}>
          {slots.map((slot) => <DisplayCard key={slot.id} slot={slot} kioskMode={kioskMode} kioskToken={kioskToken} broken={brokenImages[slot.id]} onBroken={() => setBrokenImages((prev) => ({ ...prev, [slot.id]: true }))} />)}
        </div>
      )}

      <footer className="mt-2 flex items-center justify-between gap-3 border-t border-white/20 pt-2 text-[9px] font-bold uppercase tracking-wider text-white/55 sm:mt-3"><span className="inline-flex items-center gap-2"><ShieldCheck size={13} className="text-[#65f0d1]" />Live inventory board</span><span>Updated every {refreshSeconds}s</span></footer>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return <div className="inline-flex items-center gap-3 border border-[#16d5d8]/60 bg-[#094a57] px-3 py-1.5"><p className="truncate text-[8px] font-bold uppercase tracking-[0.13em] text-white/65 sm:text-[9px]">{label}</p><p className="text-lg font-black tabular-nums sm:text-xl">{value}</p></div>;
}

function DisplayCard({ slot, kioskMode, kioskToken, broken, onBroken }: { slot: TvDisplaySlot; kioskMode: boolean; kioskToken?: string; broken?: boolean; onBroken: () => void }) {
  const imageSrc = slot.gameImage && kioskToken ? `${slot.gameImage}?token=${encodeURIComponent(kioskToken)}` : slot.gameImage;
  return <article className={`group relative flex min-h-0 flex-col overflow-hidden border-2 border-[#12283a] bg-white shadow-[0_2px_0_rgba(0,0,0,0.45)] ${kioskMode ? "text-[0.85em]" : ""}`}>
    <div className={`relative min-h-0 overflow-hidden bg-[#e6f4f4] ${kioskMode ? "flex-1" : "aspect-[1.15]"}`}>
      {imageSrc && !broken ? <Image src={imageSrc} alt={`${slot.gameName} ticket pack`} fill unoptimized className="object-contain p-0.5 transition-transform duration-300 group-hover:scale-[1.02]" onError={onBroken} /> : <div className="flex h-full items-center justify-center bg-[#c8eeee] text-4xl font-black text-[#087d8a]">{slot.gameName.slice(0, 1).toUpperCase()}</div>}
      <div className="absolute left-0 top-0 bg-[#102b40] px-1.5 py-1 text-[8px] font-black uppercase text-white sm:text-[10px]">Display {slot.slotNumber}</div>
    </div>
    <div className="shrink-0 border-t-2 border-[#102b40] bg-white text-[#101828]">
      <div className="flex items-center justify-between gap-1 border-b border-[#c9d9df] bg-[#f7fbfb] px-1.5 py-1 sm:px-2">
        <div className="min-w-0"><h3 className="truncate text-[9px] font-black leading-tight sm:text-xs">{slot.gameName}</h3><p className="truncate text-[7px] font-bold uppercase text-[#667085] sm:text-[8px]">Game {slot.gameNumber} · ${slot.ticketPrice.toFixed(0)}</p></div>
        <span className={`shrink-0 px-1 py-0.5 text-[6px] font-black uppercase sm:text-[7px] ${slot.sellDirection === "LAST" ? "bg-[#fff0db] text-[#8a4b08]" : "bg-[#e7f4ed] text-[#17633b]"}`}>{slot.sellDirection === "LAST" ? "LAST" : "FIRST"}</span>
      </div>
      <div className="grid grid-cols-2 bg-[#eef8f8]">
        <div className="flex items-center justify-between gap-1 border-r border-[#c9d9df] px-1.5 py-1 sm:px-2 sm:py-1.5"><span className="text-[6px] font-black uppercase tracking-wide text-[#667085] sm:text-[8px]">Current</span><strong className="text-base font-black leading-none tabular-nums text-[#c62828] sm:text-xl">{slot.currentTicket}</strong></div>
        <div className="flex items-center justify-between gap-1 px-1.5 py-1 sm:px-2 sm:py-1.5"><span className="text-[6px] font-black uppercase tracking-wide text-[#667085] sm:text-[8px]">Next</span><strong className="text-base font-black leading-none tabular-nums text-[#17233f] sm:text-xl">{slot.nextTicket > 0 ? slot.nextTicket : "—"}</strong></div>
      </div>
    </div>
    {!kioskMode && <div className="h-1 bg-[#d8e8ec]"><div className="h-1 bg-[#0d82a6]" style={{ width: `${Math.min(slot.quantity > 0 ? Math.max((slot.sold / slot.quantity) * 100, 0) : 0, 100)}%` }} /></div>}
  </article>;
}
