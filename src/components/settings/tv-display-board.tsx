"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, RefreshCw, ShieldCheck } from "lucide-react";

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
    ? "flex h-screen min-h-0 flex-col overflow-hidden bg-[#120204] text-white"
    : "border border-[#7f1d1d] bg-[#120204] p-3 text-white sm:p-5";

  return (
    <div className={shellClass}>
      {stale && <div className="tv-delay-banner"><CircleAlert size={14} /><span><strong>Updates delayed.</strong> Showing the last verified board.</span></div>}

      {slots.length === 0 ? (
        <div className="tv-empty-state"><RefreshCw size={26} className="mx-auto mb-4 text-[#f4c542]" /><p className="text-xl font-bold">No games on display</p><p className="mt-2 text-sm text-white/60">Assign active packs to displays to populate this board.</p></div>
      ) : (
        <div className={`tv-board-stack ${slots.length > 1 ? "tv-board-stack-multiple" : ""}`}>
          {slots.map((slot) => <DisplayBoard key={slot.id} slot={slot} kioskMode={kioskMode} />)}
        </div>
      )}

      {!kioskMode && <footer className="mt-3 flex items-center justify-between gap-3 border-t border-white/20 pt-2 text-[9px] font-bold uppercase tracking-wider text-white/55"><span className="inline-flex items-center gap-2"><ShieldCheck size={13} className="text-[#f4c542]" />Live inventory board</span><span>Updated every {refreshSeconds}s</span></footer>}
      <style jsx>{`
        .tv-delay-banner { display:flex; align-items:center; gap:8px; flex:none; border:1px solid rgba(252,211,77,.45); background:rgba(252,211,77,.1); padding:6px 10px; color:#fef3c7; font-size:11px; }
        .tv-empty-state { border:1px solid rgba(255,255,255,.2); background:rgba(255,255,255,.05); padding:40px; text-align:center; }
        .tv-board-stack { display:grid; min-height:0; flex:1; gap:10px; overflow:hidden; }
        .tv-board-stack-multiple { grid-template-columns:repeat(2,minmax(0,1fr)); overflow-y:auto; }
        .tv-jackpot-board { position:relative; display:flex; min-height:0; aspect-ratio:16/9; flex-direction:column; overflow:hidden; background:#250308 url('/tv/game-types/triple-777-jackpot.png') center/cover no-repeat; box-shadow:0 5px 0 #35070a; }
        .tv-jackpot-board::after { position:absolute; inset:0; border:clamp(2px,.35vw,6px) solid rgba(0,0,0,.78); content:""; pointer-events:none; }
        .tv-top-corner { position:absolute; top:3.2%; z-index:2; display:flex; min-width:9.4%; aspect-ratio:1.45/1; align-items:center; justify-content:center; border:clamp(2px,.28vw,5px) solid #111; border-radius:22%; background:#fff; color:#050505; font-size:clamp(24px,4.7vw,92px); font-weight:1000; line-height:1; box-shadow:0 3px 0 rgba(0,0,0,.45); }
        .tv-top-corner-left { left:2.1%; }
        .tv-top-corner-right { right:2.1%; }
        .tv-live-ticket { position:absolute; top:67.2%; left:36.3%; z-index:2; display:flex; width:16.2%; aspect-ratio:1; align-items:center; justify-content:center; border:clamp(3px,.45vw,8px) solid #120b05; border-radius:50%; background:#fff; color:#050505; font-size:clamp(34px,8.5vw,170px); font-weight:1000; line-height:1; box-shadow:0 0 0 clamp(3px,.42vw,8px) #f9bd18,0 0 clamp(10px,1.4vw,28px) rgba(255,194,22,.95); animation:tv-jackpot-pulse 1.8s ease-in-out infinite; }
        .tv-live-ticket::before { position:absolute; inset:-13%; border:clamp(3px,.35vw,7px) solid #ffcf2e; border-bottom-color:transparent; border-radius:50%; content:""; transform:rotate(-22deg); }
        .tv-next-ticket { position:absolute; top:72.8%; left:50.5%; z-index:2; display:flex; width:9.6%; aspect-ratio:1; align-items:center; justify-content:center; border:clamp(2px,.32vw,6px) solid #120b05; border-radius:50%; background:#fff; color:#050505; font-size:clamp(24px,4.3vw,84px); font-weight:1000; line-height:1; box-shadow:0 0 0 clamp(2px,.25vw,5px) #f9bd18; }
        @keyframes tv-jackpot-pulse { 0%,100% { transform:scale(1); } 50% { transform:scale(1.035); } }
        @media (max-width:900px) { .tv-board-stack-multiple { grid-template-columns:1fr; overflow-y:auto; } .tv-jackpot-board { min-height:240px; } }
        @media (prefers-reduced-motion:reduce) { .tv-live-ticket { animation:none; } }
      `}</style>
    </div>
  );
}

function DisplayBoard({ slot, kioskMode }: { slot: TvDisplaySlot; kioskMode: boolean }) {
  return <article className={`tv-jackpot-board ${kioskMode ? "w-full" : "min-h-[260px]"}`} aria-label={`${slot.gameName} display ${slot.slotNumber}`}>
    <div className="tv-top-corner tv-top-corner-left" aria-label={`Display ${slot.slotNumber}`}>{slot.slotNumber}</div>
    <div className="tv-top-corner tv-top-corner-right" aria-label={`Ticket price $${slot.ticketPrice.toFixed(0)}`}>${slot.ticketPrice.toFixed(0)}</div>
    <div className="tv-live-ticket" aria-label={`Current ticket ${slot.currentTicket}`}>{slot.currentTicket}</div>
    <div className="tv-next-ticket" aria-label={`Next ticket ${slot.nextTicket > 0 ? slot.nextTicket : "none"}`}>{slot.nextTicket > 0 ? slot.nextTicket : "—"}</div>
  </article>;
}
