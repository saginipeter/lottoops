"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, ShieldCheck, CircleAlert } from "lucide-react";

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

export function TvDisplayBoard({ slots, kioskMode, refreshSeconds }: TvDisplayBoardProps) {
  const router = useRouter();
  const [lastRefreshAt, setLastRefreshAt] = useState<Date>(new Date());
  const [stale, setStale] = useState(false);

  const refreshBoard = useCallback(() => {
    router.refresh();
    window.setTimeout(() => {
      setLastRefreshAt(new Date());
      setStale(false);
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

  const shellClass = kioskMode
    ? "flex h-screen min-h-0 flex-col overflow-hidden bg-[#062f3a] p-1 text-white sm:p-2"
    : "border border-[#0d82a6] bg-[#062f3a] p-3 text-white sm:p-5";

  return (
    <div className={shellClass}>
      {stale && <div className="mb-3 flex items-center gap-2 border border-amber-400/50 bg-amber-300/10 px-3 py-2 text-xs text-amber-100 sm:mb-4"><CircleAlert size={15} /><span><strong>Updates delayed.</strong> Showing the last verified board.</span></div>}

      {slots.length === 0 ? (
        <div className="border border-white/20 bg-white/5 p-10 text-center"><RefreshCw size={26} className="mx-auto mb-4 text-fuchsia-200" /><p className="text-xl font-bold">No games on display</p><p className="mt-2 text-sm text-white/60">Assign active packs to displays to populate this board.</p></div>
      ) : (
        <div className={`${kioskMode ? "grid min-h-0 flex-1 gap-1 overflow-hidden sm:gap-2" : "grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5 2xl:grid-cols-7"} border-2 border-[#16d5d8] bg-[#16d5d8] p-1 shadow-[0_4px_0_#02262e] sm:p-2`} style={kioskMode ? { gridTemplateColumns: `repeat(${Math.min(Math.max(Math.ceil(Math.sqrt(slots.length * 1.55)), 1), 8)}, minmax(0, 1fr))`, gridAutoRows: "minmax(0, 1fr)" } : undefined}>
          {slots.map((slot, index) => <DisplayCard key={slot.id} slot={slot} kioskMode={kioskMode} artIndex={index} />)}
        </div>
      )}

      {!kioskMode && <footer className="mt-3 flex items-center justify-between gap-3 border-t border-white/20 pt-2 text-[9px] font-bold uppercase tracking-wider text-white/55"><span className="inline-flex items-center gap-2"><ShieldCheck size={13} className="text-[#65f0d1]" />Live inventory board</span><span>Updated every {refreshSeconds}s</span></footer>}
      <style jsx>{`@keyframes tv-artwork-drift { from { transform: scale(1.04) translate3d(-1%, -1%, 0); } to { transform: scale(1.12) translate3d(1%, 1%, 0); } }`}</style>
    </div>
  );
}
function DisplayCard({ slot, kioskMode, artIndex }: { slot: TvDisplaySlot; kioskMode: boolean; artIndex: number }) {
  const referenceImage = `/tv/reference-games/game-${String((artIndex % 40) + 1).padStart(2, "0")}.jpg`;
  return <article className={`group relative flex min-h-0 flex-col overflow-hidden border-2 border-[#12283a] bg-white shadow-[0_2px_0_rgba(0,0,0,0.45)] ${kioskMode ? "text-[0.85em]" : ""}`}>
    <div className="flex shrink-0 items-center justify-center gap-2 bg-[#102b40] px-2 py-1 font-black text-white">
      <span className="text-[10px] uppercase sm:text-xs">Display</span>
      <strong className="min-w-0 break-all text-2xl leading-none tabular-nums sm:text-4xl">{slot.slotNumber}</strong>
    </div>
    <div className={`relative min-h-0 overflow-hidden bg-[#e6f4f4] ${kioskMode ? "flex-1" : "aspect-[0.85]"}`}>
      <Image src={slot.gameImage || referenceImage} alt={`${slot.gameName} lottery game artwork`} fill unoptimized className="object-contain" />
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
