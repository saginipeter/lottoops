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

const SLOTS_PER_SLIDE = 15;
const SLIDE_SECONDS = 10;

export function TvDisplayBoard({ slots, kioskMode, refreshSeconds }: TvDisplayBoardProps) {
  const router = useRouter();
  const [lastRefreshAt, setLastRefreshAt] = useState<Date>(new Date());
  const [stale, setStale] = useState(false);
  const [slide, setSlide] = useState(0);
  const slideCount = Math.max(1, Math.ceil(slots.length / SLOTS_PER_SLIDE));
  const activeSlide = Math.min(slide, slideCount - 1);
  const slideOffset = activeSlide * SLOTS_PER_SLIDE;
  const visibleSlots = slots.slice(slideOffset, slideOffset + SLOTS_PER_SLIDE);

  useEffect(() => {
    if (slideCount <= 1) return;
    const timer = setInterval(() => {
      setSlide((current) => (Math.min(current, slideCount - 1) + 1) % slideCount);
    }, SLIDE_SECONDS * 1000);
    return () => clearInterval(timer);
  }, [slideCount]);

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
        <div className={`grid grid-cols-5 grid-rows-3 ${kioskMode ? "min-h-0 flex-1 gap-1 overflow-hidden sm:gap-2" : "gap-2 sm:gap-3"} border-2 border-[#16d5d8] bg-[#16d5d8] p-1 shadow-[0_4px_0_#02262e] sm:p-2`}>
          {visibleSlots.map((slot, index) => <DisplayCard key={slot.id} slot={slot} kioskMode={kioskMode} artIndex={slideOffset + index} />)}
        </div>
      )}

      {slideCount > 1 && (
        <div className="group/slides absolute inset-x-0 bottom-0 z-20 flex justify-center pb-2 pt-6">
          <nav aria-label="Display slides" className="pointer-events-none flex items-center justify-center gap-4 rounded bg-[#062f3a]/95 px-3 py-2 text-xs font-bold opacity-0 transition-opacity group-hover/slides:pointer-events-auto group-hover/slides:opacity-100 group-focus-within/slides:pointer-events-auto group-focus-within/slides:opacity-100">
            <button type="button" aria-label="Previous slide" className="rounded border border-white/30 px-3 py-1 hover:bg-white/10" onClick={() => setSlide((activeSlide + slideCount - 1) % slideCount)}>Previous</button>
            <span>Slide {activeSlide + 1} of {slideCount}</span>
            <button type="button" aria-label="Next slide" className="rounded border border-white/30 px-3 py-1 hover:bg-white/10" onClick={() => setSlide((activeSlide + 1) % slideCount)}>Next</button>
          </nav>
        </div>
      )}

      {!kioskMode && <footer className="mt-3 flex items-center justify-between gap-3 border-t border-white/20 pt-2 text-[9px] font-bold uppercase tracking-wider text-white/55"><span className="inline-flex items-center gap-2"><ShieldCheck size={13} className="text-[#65f0d1]" />Live inventory board</span><span>Updated every {refreshSeconds}s</span></footer>}
      <style jsx>{`@keyframes tv-artwork-drift { from { transform: scale(1.04) translate3d(-1%, -1%, 0); } to { transform: scale(1.12) translate3d(1%, 1%, 0); } }`}</style>
    </div>
  );
}
function DisplayCard({ slot, kioskMode, artIndex }: { slot: TvDisplaySlot; kioskMode: boolean; artIndex: number }) {
  const referenceImage = `/tv/reference-games/game-${String((artIndex % 40) + 1).padStart(2, "0")}.jpg`;
  return <article className={`group relative min-h-0 overflow-hidden bg-[#0b1724] shadow-[0_2px_0_rgba(0,0,0,0.45)] ${kioskMode ? "h-full text-[0.85em]" : "aspect-[0.78]"}`}>
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
    <div className="absolute inset-x-0 bottom-0 z-10 border-t border-white/20 bg-[#071827]/85 px-2 py-1.5 text-white backdrop-blur-sm sm:px-3">
      <div className="flex min-w-0 items-center justify-between gap-1 whitespace-nowrap text-[clamp(0.5rem,1.5vw,1.5rem)] font-black leading-none text-white">
        <strong className="tabular-nums">{slot.nextTicket > 0 ? slot.nextTicket : "—"}</strong>
        <strong>NEW TICKET</strong>
      </div>
    </div>
  </article>;
}
