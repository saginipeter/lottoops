"use client";

import Image from "next/image";
import { type CSSProperties, useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, RefreshCw, ShieldCheck } from "lucide-react";

type TvDisplaySlot = {
  id: string;
  packId: string;
  gameId: string;
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
  verifiedAt?: number;
}

export function TvDisplayBoard({ slots, kioskMode, refreshSeconds, verifiedAt }: TvDisplayBoardProps) {
  const router = useRouter();
  const [stale, setStale] = useState(false);
  const lastVerified = useRef(0);
  const latestSnapshot = useRef(verifiedAt ?? 0);
  const refreshLock = useRef(false);
  const [isRefreshing, startRefresh] = useTransition();

  useEffect(() => {
    refreshLock.current = isRefreshing;
  }, [isRefreshing]);

  useEffect(() => {
    // The server stamps this only after its database read succeeds. A timer is not an acknowledgement.
    if (lastVerified.current === 0 || (verifiedAt !== undefined && verifiedAt > latestSnapshot.current)) {
      latestSnapshot.current = verifiedAt ?? latestSnapshot.current;
      lastVerified.current = Date.now();
    }
  }, [verifiedAt]);

  const refreshBoard = useCallback(() => {
    if (refreshLock.current || !navigator.onLine) return;
    refreshLock.current = true;
    startRefresh(() => router.refresh());
  }, [router]);

  useEffect(() => {
    const refresh = setInterval(() => void refreshBoard(), refreshSeconds * 1000);
    window.addEventListener("online", refreshBoard);
    return () => {
      clearInterval(refresh);
      window.removeEventListener("online", refreshBoard);
    };
  }, [refreshBoard, refreshSeconds]);

  useEffect(() => {
    const watchdog = setInterval(() => setStale(Date.now() - lastVerified.current > refreshSeconds * 2000), 1000);
    return () => clearInterval(watchdog);
  }, [refreshSeconds]);

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
          {slots.map((slot) => <DisplayBoard key={`${slot.id}-${slot.gameId}-${slot.gameImage ?? "missing"}`} slot={slot} />)}
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
        .tv-image-unavailable { position:absolute; inset:0; z-index:0; display:flex; align-items:center; justify-content:center; padding:4px; background:#111827; color:#f9fafb; font-size:7px; font-weight:800; line-height:1.15; text-align:center; text-transform:uppercase; }
        .tv-jackpot-board::after { position:absolute; inset:0; border:1px solid rgba(255,255,255,.55); content:""; pointer-events:none; }
        .tv-top-corner { position:absolute; top:2px; z-index:2; display:flex; min-width:16px; height:13px; align-items:center; justify-content:center; border:1px solid #111; border-radius:2px; background:#fff; color:#050505; font-size:8px; font-weight:900; line-height:1; }
        .tv-top-corner-left { left:2px; }
        .tv-top-corner-right { right:2px; }
        .tv-ticket-indicators { position:absolute; right:0; bottom:0; left:0; z-index:3; display:flex; height:39%; align-items:flex-end; justify-content:space-between; box-sizing:border-box; padding:4% 5% 3%; container-type:inline-size; background:transparent; pointer-events:none; }
        .tv-ticket-badge { display:flex; min-width:0; flex-direction:column; align-items:center; gap:4cqi; }
        .tv-ticket-badge-current { width:54%; }
        .tv-ticket-badge-next { width:37%; }
        .tv-ticket-circle { position:relative; display:grid; width:84%; aspect-ratio:1; box-sizing:border-box; padding:7%; border-radius:50%; background:linear-gradient(135deg,#fffbc0 0%,#ffdb3b 18%,#c47805 38%,#fff5b0 54%,#ffc600 73%,#fff9bb 100%); box-shadow:0 0 1cqi #ffe575,0 0 5cqi rgba(255,191,0,.65); transform-origin:center; }
        .tv-ticket-badge-next .tv-ticket-circle { width:80%; }
        .tv-ticket-circle::before { position:absolute; inset:-14%; border-radius:50%; background:conic-gradient(from 26deg,transparent 0deg,#ffeb66 8deg,#ffd000 42deg,transparent 54deg,transparent 124deg,#ffd000 134deg,#fff6a4 164deg,transparent 180deg,transparent 304deg,#ffda24 320deg,#ffef83 340deg,transparent 352deg); mask:radial-gradient(farthest-side,transparent 89%,#000 91%); filter:drop-shadow(0 0 1cqi #ffd429); content:""; }
        .tv-ticket-face { position:relative; display:grid; width:100%; height:100%; place-items:center; box-sizing:border-box; border:1.5cqi solid #100d06; border-radius:50%; background:radial-gradient(circle at 40% 30%,#fff 0%,#fff 60%,#eef0f3 100%); container-type:inline-size; }
        .tv-ticket-number { display:block; max-width:100%; color:#050505; font-family:"Arial Black",Arial,Helvetica,sans-serif; font-size:calc(100cqi / var(--ticket-digit-divisor,1.6)); font-weight:900; font-variant-numeric:tabular-nums; letter-spacing:-.055em; line-height:1; text-align:center; white-space:nowrap; }
        .tv-ticket-label { position:relative; display:block; width:100%; box-sizing:border-box; padding:1.5cqi .5cqi; border:1cqi solid #f9d342; border-radius:999px; background:#080806; box-shadow:0 0 2cqi rgba(255,196,0,.35); color:#fff08b; font-family:Arial,Helvetica,sans-serif; font-size:5.4cqi; font-weight:900; letter-spacing:-.02em; line-height:1; text-align:center; white-space:nowrap; }
        .tv-ticket-badge-next .tv-ticket-label { font-size:5cqi; }
        /* Deliberate, TV-only exception to globals.css's sharp-edge !important rule. */
        .tv-ticket-circle,.tv-ticket-face { border-radius:50% !important; }
        .tv-ticket-label { border-radius:999px !important; }
        @keyframes tv-ticket-pulse { 0%,100% { transform:scale(1); } 50% { transform:scale(1.035); } }
        @media (prefers-reduced-motion:no-preference) { .tv-ticket-badge-current .tv-ticket-circle { animation:tv-ticket-pulse 2.4s ease-in-out infinite; } }
        @media (max-width:900px) { .tv-board-stack { gap:3px; padding:5px; } }
      `}</style>
    </div>
  );
}

function DisplayBoard({ slot }: { slot: TvDisplaySlot }) {
  const [imageFailed, setImageFailed] = useState(false);
  const hasArtwork = Boolean(slot.gameImage) && !imageFailed;

  return <article className="tv-jackpot-board" style={{ width: "2cm", height: "3cm", flex: "0 0 2cm" }} aria-label={`${slot.gameName} display ${slot.slotNumber}`}>
    {hasArtwork ? (
      <Image
        className="tv-jackpot-art"
        style={{ objectFit: "cover", objectPosition: "center" }}
        src={slot.gameImage as string}
        alt={`${slot.gameName} artwork`}
        fill
        sizes="32px"
        unoptimized
        priority
        onError={() => setImageFailed(true)}
      />
    ) : (
      <div className="tv-image-unavailable" role="img" aria-label={`${slot.gameName} image not available`}>
        Image not available
      </div>
    )}
    <div className="tv-top-corner tv-top-corner-left" aria-label={`Display ${slot.slotNumber}`}>{slot.slotNumber}</div>
    <div className="tv-top-corner tv-top-corner-right" aria-label={`Ticket price $${slot.ticketPrice.toFixed(0)}`}>${slot.ticketPrice.toFixed(0)}</div>
    <div className="tv-ticket-indicators" role="group" aria-label="Live ticket availability">
      <TicketIndicator kind="current" ticket={slot.remaining > 0 ? slot.currentTicket : null} />
      <TicketIndicator kind="next" ticket={slot.remaining > 1 ? slot.nextTicket : null} />
    </div>
  </article>;
}

function TicketIndicator({ kind, ticket }: { kind: "current" | "next"; ticket: number | null }) {
  const value = ticket !== null && Number.isSafeInteger(ticket) && ticket > 0 ? String(ticket) : "—";
  // Sizing belongs to the face, not the viewport. Digits scale and pulse with their ring.
  const numberStyle = { "--ticket-digit-divisor": Math.max(1.6, value.length * .74 + .1) } as CSSProperties;
  const label = kind === "current" ? "CURRENT TICKET" : "NEXT TICKET";

  return <div className={`tv-ticket-badge tv-ticket-badge-${kind}`} aria-label={`${label}: ${value === "—" ? "unavailable" : value}`}>
    <div className="tv-ticket-circle">
      <div className="tv-ticket-face"><span className="tv-ticket-number" style={numberStyle}>{value}</span></div>
    </div>
    <span className="tv-ticket-label">{label}</span>
  </div>;
}
