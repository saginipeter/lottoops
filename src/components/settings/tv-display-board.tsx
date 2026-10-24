"use client";

import Image from "next/image";
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
    ? "flex h-screen min-h-0 flex-col overflow-hidden bg-black text-white"
    : "border border-black bg-black p-3 text-white sm:p-5";

  return (
    <div className={shellClass}>
      {stale && <div className="tv-delay-banner"><CircleAlert size={14} /><span><strong>Updates delayed.</strong> Showing the last verified board.</span></div>}

      {slots.length === 0 ? (
        <div className="tv-empty-state"><RefreshCw size={26} className="mx-auto mb-4 text-[#f4c542]" /><p className="text-xl font-bold">No games on display</p><p className="mt-2 text-sm text-white/60">Assign active packs to displays to populate this board.</p></div>
      ) : (
        <div className={`tv-board-stack ${slots.length > 1 ? "tv-board-stack-multiple" : ""}`}>
          {slots.map((slot) => <DisplayBoard key={slot.id} slot={slot} />)}
        </div>
      )}

      {!kioskMode && <footer className="mt-3 flex items-center justify-between gap-3 border-t border-white/20 pt-2 text-[9px] font-bold uppercase tracking-wider text-white/55"><span className="inline-flex items-center gap-2"><ShieldCheck size={13} className="text-[#f4c542]" />Live inventory board</span><span>Updated every {refreshSeconds}s</span></footer>}
      <style jsx global>{`
        .tv-delay-banner { display:flex; align-items:center; gap:8px; flex:none; border:1px solid rgba(252,211,77,.45); background:rgba(252,211,77,.1); padding:6px 10px; color:#fef3c7; font-size:11px; }
        .tv-empty-state { border:1px solid rgba(255,255,255,.2); background:rgba(255,255,255,.05); padding:40px; text-align:center; }
        .tv-board-stack { display:flex; min-height:0; flex:1; flex-wrap:wrap; align-content:flex-start; gap:4px; overflow:auto; background:#000; padding:8px; }
        .tv-board-stack-multiple { overflow:auto; }
        .tv-jackpot-board { position:relative; display:block; width:2cm; height:3cm; flex:0 0 2cm; overflow:hidden; background:#000; }
        .tv-jackpot-art { position:absolute; inset:0; z-index:0; width:100%; height:100%; object-fit:cover; object-position:center; }
        .tv-jackpot-board::after { position:absolute; inset:0; border:1px solid rgba(255,255,255,.55); content:""; pointer-events:none; }
        .tv-top-corner { position:absolute; top:2px; z-index:2; display:flex; min-width:16px; height:13px; align-items:center; justify-content:center; border:1px solid #111; border-radius:2px; background:#fff; color:#050505; font-size:8px; font-weight:900; line-height:1; }
        .tv-top-corner-left { left:2px; }
        .tv-top-corner-right { right:2px; }
        .tv-placeholder { position:absolute; z-index:3; }
        .tv-placeholder[data-loaded="false"] { visibility:hidden; }
        .tv-placeholder-art { position:absolute; inset:0; width:100%; height:100%; object-fit:contain; }
        .tv-placeholder-value { position:absolute; display:flex; align-items:center; justify-content:center; overflow:hidden; color:#050505; font-size:clamp(7px, 1.2cqw, 13px); font-weight:900; line-height:1; text-align:center; white-space:nowrap; }
        .tv-placeholder-slot,.tv-placeholder-price { top:2px; width:16px; height:13px; }
        .tv-placeholder-slot { left:2px; }
        .tv-placeholder-price { right:2px; }
        .tv-placeholder-slot-value,.tv-placeholder-price-value { inset:0; font-size:8px; }
        .tv-placeholder-current { left:3%; top:64%; width:44%; aspect-ratio:650 / 530; animation:tv-current-placeholder-glow 2.4s ease-in-out infinite; }
        .tv-placeholder-next { left:56%; top:67%; width:38%; aspect-ratio:650 / 530; }
        .tv-placeholder-current-value { left:25%; top:24%; width:50%; height:54%; border:1px solid #111; border-radius:50%; background:#fff; font-size:10px; }
        .tv-placeholder-next-value { left:24%; top:24%; width:52%; height:54%; border:1px solid #111; border-radius:50%; background:#fff; font-size:8px; }
        .tv-placeholder-slot { width:16px; height:13px; aspect-ratio:900 / 405; }
        .tv-placeholder-price { width:16px; height:13px; aspect-ratio:760 / 390; }
        .tv-placeholder-slot-value { left:20%; top:48%; width:60%; height:28%; border-radius:999px; background:#fff; font-size:5px; }
        .tv-placeholder-price-value { left:19%; top:51%; width:62%; height:27%; border-radius:999px; background:#fff; font-size:5px; }
        @keyframes tv-current-placeholder-glow { 0%,100% { filter:drop-shadow(0 0 1px rgba(250,204,21,.25)); } 50% { filter:drop-shadow(0 0 3px rgba(250,204,21,.75)); } }
        @media (prefers-reduced-motion: reduce) { .tv-placeholder-current { animation:none; } }
        @media (max-width:900px) { .tv-board-stack { gap:3px; padding:5px; } }
      `}</style>
    </div>
  );
}

function DisplayBoard({ slot }: { slot: TvDisplaySlot }) {
  return <article className="tv-jackpot-board" style={{ width: "2cm", height: "3cm", flex: "0 0 2cm" }} aria-label={`${slot.gameName} display ${slot.slotNumber}`}>
    <Image className="tv-jackpot-art" style={{ objectFit: "cover", objectPosition: "center" }} src={slot.gameImage || "/tv/game-types/triple-777-tile.jpeg"} alt={`${slot.gameName} artwork`} fill sizes="32px" unoptimized priority />
    <TvPlaceholderValue
      src="/tv/placeholders/slot-number.png"
      alt="Slot number frame"
      value={slot.slotNumber}
      placement="tv-placeholder-slot"
      valuePlacement="tv-placeholder-slot-value"
      fallback={<div className="tv-top-corner tv-top-corner-left" aria-label={`Display ${slot.slotNumber}`}>{slot.slotNumber}</div>}
    />
    <TvPlaceholderValue
      src="/tv/placeholders/ticket-price.png"
      alt="Ticket price frame"
      value={`$${slot.ticketPrice.toFixed(0)}`}
      placement="tv-placeholder-price"
      valuePlacement="tv-placeholder-price-value"
      fallback={<div className="tv-top-corner tv-top-corner-right" aria-label={`Ticket price $${slot.ticketPrice.toFixed(0)}`}>${slot.ticketPrice.toFixed(0)}</div>}
    />
    <TvPlaceholderValue
      src="/tv/placeholders/current-ticket.png"
      alt="Current ticket frame"
      value={slot.currentTicket === 0 ? "SOLD OUT" : String(slot.currentTicket)}
      placement="tv-placeholder-current"
      valuePlacement="tv-placeholder-current-value"
    />
    <TvPlaceholderValue
      src="/tv/placeholders/next-ticket.png"
      alt="Next ticket frame"
      value={slot.nextTicket === 0 ? "—" : String(slot.nextTicket)}
      placement="tv-placeholder-next"
      valuePlacement="tv-placeholder-next-value"
    />
  </article>;
}

function TvPlaceholderValue({
  src,
  alt,
  value,
  placement,
  valuePlacement = "",
  fallback,
}: {
  src: string;
  alt: string;
  value: string;
  placement: string;
  valuePlacement?: string;
  fallback?: React.ReactNode;
}) {
  const [loaded, setLoaded] = useState(false);

  return <>
    {!loaded && fallback}
    <div className={`tv-placeholder ${placement}`} data-loaded={loaded} aria-label={`${alt.replace(" frame", "")}: ${value}`}>
      <Image
        className="tv-placeholder-art"
        src={src}
        alt=""
        fill
        sizes="32px"
        unoptimized
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(false)}
      />
      {loaded && <span className={`tv-placeholder-value ${valuePlacement}`}>{value}</span>}
    </div>
  </>;
}
