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
    <div className={`relative ${shellClass}`}>
      {stale && <div className="mb-3 flex items-center gap-2 border border-amber-400/50 bg-amber-300/10 px-3 py-2 text-xs text-amber-100 sm:mb-4"><CircleAlert size={15} /><span><strong>Updates delayed.</strong> Showing the last verified board.</span></div>}

      {slots.length === 0 ? (
        <div className="border border-white/20 bg-white/5 p-10 text-center"><RefreshCw size={26} className="mx-auto mb-4 text-fuchsia-200" /><p className="text-xl font-bold">No games on display</p><p className="mt-2 text-sm text-white/60">Assign active packs to displays to populate this board.</p></div>
      ) : (
        <div className={`grid grid-cols-5 ${kioskMode ? "min-h-0 flex-1 gap-1 overflow-y-auto sm:gap-2" : "gap-2 sm:gap-3"} border-2 border-[#16d5d8] bg-[#16d5d8] p-1 shadow-[0_4px_0_#02262e] sm:p-2`}>
          {slots.map((slot, index) => <DisplayCard key={slot.id} slot={slot} artIndex={index} />)}
        </div>
      )}

      {!kioskMode && <footer className="mt-3 flex items-center justify-between gap-3 border-t border-white/20 pt-2 text-[9px] font-bold uppercase tracking-wider text-white/55"><span className="inline-flex items-center gap-2"><ShieldCheck size={13} className="text-[#65f0d1]" />Live inventory board</span><span>Updated every {refreshSeconds}s</span></footer>}
      <style jsx>{`@keyframes tv-artwork-drift { from { transform: scale(1.04) translate3d(-1%, -1%, 0); } to { transform: scale(1.12) translate3d(1%, 1%, 0); } }`}</style>
    </div>
  );
}
function DisplayCard({ slot, artIndex }: { slot: TvDisplaySlot; artIndex: number }) {
  const referenceImage = `/tv/reference-games/game-${String((artIndex % 40) + 1).padStart(2, "0")}.jpg`;
  return <article className="@container group relative aspect-[0.78] overflow-hidden bg-[#0b1724] shadow-[0_2px_0_rgba(0,0,0,0.45)]">
    <strong className="absolute right-2 top-2 z-10 rounded-sm bg-[#1A365D] px-2 py-1 text-xl font-black leading-none tabular-nums text-white shadow sm:text-2xl">{slot.slotNumber}</strong>
    <div className="absolute inset-0 overflow-hidden">
      <Image
        src={slot.gameImage || referenceImage}
        alt={`${slot.gameName} lottery game artwork`}
        fill
        sizes="20vw"
        unoptimized
        className="object-cover"
      />
    </div>
    <div className="absolute inset-x-0 bottom-0 z-10 border-t border-white/20 bg-[#071827]/85 px-1 py-1.5 text-white backdrop-blur-sm sm:px-3">
      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="min-w-0">
          <strong className="block truncate text-[clamp(0.45rem,3cqw,0.75rem)] leading-tight">CURRENT TICKET</strong>
          <strong className="block tabular-nums text-[clamp(0.8rem,6cqw,1.4rem)] leading-tight text-white">
            {slot.currentTicket > 0 ? slot.currentTicket : "—"}
          </strong>
        </div>
        <div className="min-w-0">
          <strong className="block truncate text-[clamp(0.45rem,3cqw,0.75rem)] leading-tight">NEXT TICKET</strong>
          <strong className="block tabular-nums text-[clamp(0.8rem,6cqw,1.4rem)] leading-tight text-amber-300">
            {slot.nextTicket > 0 ? slot.nextTicket : "—"}
          </strong>
        </div>
      </div>
    </div>
  </article>;
}
