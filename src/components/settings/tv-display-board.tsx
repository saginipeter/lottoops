"use client";

import Image from "next/image";
import { type CSSProperties, useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, CircleAlert, RefreshCw, ShieldCheck } from "lucide-react";
import { parseTvScreenNumber, splitTvScreens, TV_SCREEN_CAPACITY, TV_SCREEN_ROTATION_SECONDS } from "@/lib/tv-screens";

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
  screenNumber?: number;
}

export function TvDisplayBoard({ slots, kioskMode, refreshSeconds, verifiedAt, kioskToken, screenNumber = 1 }: TvDisplayBoardProps) {
  const router = useRouter();
  const [stale, setStale] = useState(false);
  const lastVerified = useRef(0);
  const latestSnapshot = useRef(verifiedAt ?? 0);
  const refreshLock = useRef(false);
  const [isRefreshing, startRefresh] = useTransition();
  const screens = splitTvScreens(slots);
  const selectedScreen = parseTvScreenNumber(screenNumber);
  const visibleSlots = screens[selectedScreen - 1] ?? [];

  const screenHref = useCallback((screen: number) => {
    const params = new URLSearchParams({ screen: String(screen), interval: String(refreshSeconds) });
    if (kioskToken) params.set("token", kioskToken);
    return `${kioskMode ? "/tv-display" : "/settings/tv-display"}?${params.toString()}`;
  }, [kioskMode, kioskToken, refreshSeconds]);

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
    if (!kioskMode || screens.length <= 1) return;
    const rotate = window.setInterval(() => {
      const nextScreen = selectedScreen >= screens.length ? 1 : selectedScreen + 1;
      router.replace(screenHref(nextScreen), { scroll: false });
    }, TV_SCREEN_ROTATION_SECONDS * 1000);
    return () => window.clearInterval(rotate);
  }, [kioskMode, router, screens.length, selectedScreen, screenHref]);

  useEffect(() => {
    const watchdog = setInterval(() => setStale(Date.now() - lastVerified.current > refreshSeconds * 2000), 1000);
    return () => clearInterval(watchdog);
  }, [refreshSeconds]);

  const shellClass = kioskMode
    ? "tv-screen-shell flex h-screen min-h-0 flex-col overflow-hidden bg-black text-white"
    : "tv-screen-shell tv-screen-preview flex min-h-0 flex-col overflow-hidden border border-black bg-black text-white";

  return (
    <div className={shellClass} data-live-status={stale ? "delayed" : "live"} data-screen-number={selectedScreen}>
      {stale && <div className="tv-delay-banner"><CircleAlert size={14} /><span><strong>Updates delayed.</strong> Showing the last verified board.</span></div>}

      {visibleSlots.length === 0 ? (
        <div className="tv-empty-state"><RefreshCw size={26} className="mx-auto mb-4 text-[#f4c542]" /><p className="text-xl font-bold">{selectedScreen === 1 && slots.length === 0 ? "No games on display" : `No games on Screen ${selectedScreen}`}</p><p className="mt-2 text-sm text-white/60">{selectedScreen > 1 ? "This screen will populate automatically when more active displays are available." : "Assign active packs to displays to populate this board."}</p></div>
      ) : (
        <div key={selectedScreen} className="tv-board-stack" aria-label={`Screen ${selectedScreen}: ${visibleSlots.length} of ${TV_SCREEN_CAPACITY} displays`}>
          {visibleSlots.map((slot) => <DisplayBoard key={`${slot.id}-${slot.gameId}-${slot.gameImage ?? "missing"}`} slot={slot} />)}
        </div>
      )}

      {(screens.length > 1 || selectedScreen > 1) && (
        <nav className="tv-screen-controls" aria-label="TV screen navigation">
          {selectedScreen > 1 ? <a href={screenHref(selectedScreen - 1)} aria-label="Previous screen"><ChevronLeft size={16} />Previous</a> : <span aria-disabled="true"><ChevronLeft size={16} />Previous</span>}
          <span className="tv-screen-count">Screen {selectedScreen} of {Math.max(screens.length, selectedScreen)} <small>{visibleSlots.length}/{TV_SCREEN_CAPACITY} displays</small></span>
          {selectedScreen < screens.length ? <a href={screenHref(selectedScreen + 1)} aria-label="Next screen">Next<ChevronRight size={16} /></a> : <span aria-disabled="true">Next<ChevronRight size={16} /></span>}
        </nav>
      )}

      {!kioskMode && <footer className="tv-preview-footer"><span className="inline-flex items-center gap-2"><ShieldCheck size={13} className="text-[#f4c542]" />Live inventory board</span><span>Updated every {refreshSeconds}s</span></footer>}
      <style jsx global>{`
        .tv-screen-preview { height:min(70vh,900px); }
        .tv-delay-banner { display:flex; align-items:center; gap:8px; flex:none; border:1px solid rgba(252,211,77,.45); background:rgba(252,211,77,.1); padding:6px 10px; color:#fef3c7; font-size:11px; }
        .tv-empty-state { display:flex; min-height:0; flex:1; flex-direction:column; align-items:center; justify-content:center; border:1px solid rgba(255,255,255,.2); background:rgba(255,255,255,.05); padding:20px; text-align:center; }
        .tv-board-stack { display:grid; min-height:0; min-width:0; flex:1; grid-template-columns:repeat(10,minmax(0,1fr)); grid-template-rows:repeat(4,minmax(0,1fr)); gap:8px; overflow:hidden; background:#000; padding:0; }
        .tv-jackpot-board { position:relative; display:block; min-width:0; min-height:0; width:100%; height:100%; overflow:hidden; background:#000; container-type:size; }
        .tv-jackpot-art { position:absolute; inset:0; z-index:0; width:100%; height:100%; object-fit:cover; object-position:center; transform-origin:center; }
        .tv-jackpot-board-artwork::before { position:absolute; top:-10%; bottom:-10%; left:-50%; z-index:1; width:45%; background:linear-gradient(90deg,transparent,rgba(255,241,171,.2),rgba(255,255,255,.4),transparent); opacity:0; pointer-events:none; content:""; }
        .tv-image-unavailable { position:absolute; inset:0; z-index:0; display:flex; align-items:center; justify-content:center; padding:min(5cqi,12px); background:#111827; color:#f9fafb; font-size:min(8cqi,14px); font-weight:800; line-height:1.15; text-align:center; text-transform:uppercase; }
        .tv-jackpot-board::after { position:absolute; inset:0; border:1px solid rgba(255,255,255,.55); content:""; pointer-events:none; }
        .tv-top-corner { position:absolute; top:min(2cqi,5px); z-index:2; display:flex; min-width:min(18cqi,30px); height:min(13cqi,27px); align-items:center; justify-content:center; padding:0 min(2cqi,4px); border:1px solid #111; border-radius:2px; background:#fff; color:#050505; font-size:min(9cqi,18px); font-weight:900; line-height:1; }
        .tv-top-corner-center { left:50%; transform:translateX(-50%); }
        .tv-ticket-indicators { position:absolute; right:0; bottom:0; left:0; z-index:3; display:flex; height:39%; align-items:flex-end; justify-content:space-between; box-sizing:border-box; padding:min(4%,12px) min(5%,15px) min(3%,9px); container-type:inline-size; background:transparent; pointer-events:none; }
        .tv-ticket-badge { display:flex; min-width:0; flex-direction:column; align-items:center; gap:min(4cqi,11px); }
        .tv-ticket-badge-current,.tv-ticket-badge-next { width:43%; max-width:118px; }
        .tv-ticket-circle { position:relative; display:grid; width:80%; aspect-ratio:1; box-sizing:border-box; padding:7%; border-radius:50%; background:linear-gradient(135deg,#ff9a9a 0%,#ef4444 26%,#991b1b 50%,#ff6b6b 73%,#b91c1c 100%); box-shadow:0 0 min(1cqi,3px) #ff9a9a,0 0 min(5cqi,14px) rgba(239,68,68,.7); transform-origin:center; }
        .tv-ticket-circle::before { position:absolute; inset:-14%; border-radius:50%; background:conic-gradient(from 26deg,transparent 0deg,#fecaca 8deg,#ef4444 42deg,transparent 54deg,transparent 124deg,#f87171 134deg,#fee2e2 164deg,transparent 180deg,transparent 304deg,#dc2626 320deg,#fecaca 340deg,transparent 352deg); mask:radial-gradient(farthest-side,transparent 89%,#000 91%); filter:drop-shadow(0 0 min(1cqi,3px) #ef4444); content:""; }
        .tv-ticket-face { position:relative; display:grid; width:100%; height:100%; place-items:center; box-sizing:border-box; border:min(1.5cqi,4.2px) solid #100d06; border-radius:50%; background:radial-gradient(circle at 40% 30%,#fff 0%,#fff 60%,#eef0f3 100%); container-type:inline-size; }
        .tv-ticket-number { display:block; max-width:100%; color:#050505; font-family:"Arial Black",Arial,Helvetica,sans-serif; font-size:calc(100cqi / var(--ticket-digit-divisor,1.6)); font-weight:900; font-variant-numeric:tabular-nums; letter-spacing:-.055em; line-height:1; text-align:center; white-space:nowrap; }
        .tv-ticket-label { position:relative; display:block; width:100%; box-sizing:border-box; padding:min(1.5cqi,4.2px) min(.5cqi,1.5px); border:min(1cqi,3px) solid #fecaca; border-radius:999px; background:#450a0a; box-shadow:0 0 min(2cqi,6px) rgba(239,68,68,.5); color:#fee2e2; font-family:Arial,Helvetica,sans-serif; font-size:min(4.2cqi,15px); font-weight:900; letter-spacing:-.04em; line-height:1; text-align:center; white-space:nowrap; }
        /* Deliberate, TV-only exception to globals.css's sharp-edge !important rule. */
        .tv-ticket-circle,.tv-ticket-face { border-radius:50% !important; }
        .tv-ticket-label { border-radius:999px !important; }
        .tv-screen-controls { display:flex; min-height:40px; flex:none; align-items:center; justify-content:space-between; gap:8px; border-top:1px solid #333; padding:4px 10px; color:#fff08b; font:600 12px Arial,Helvetica,sans-serif; }
        .tv-screen-controls a,.tv-screen-controls > span[aria-disabled] { display:inline-flex; min-height:30px; align-items:center; gap:4px; padding:0 8px; }
        .tv-screen-controls a:focus-visible { outline:2px solid #fff08b; outline-offset:2px; }
        .tv-screen-controls > span[aria-disabled] { opacity:.35; }
        .tv-screen-count { display:flex; flex-direction:column; align-items:center; gap:2px; }
        .tv-screen-count small { color:#aaa; font-size:10px; }
        .tv-preview-footer { display:flex; min-height:28px; flex:none; align-items:center; justify-content:space-between; gap:8px; border-top:1px solid #333; padding:4px 8px; color:#aaa; font:bold 9px Arial,Helvetica,sans-serif; text-transform:uppercase; letter-spacing:.05em; }
        @keyframes tv-ticket-pulse { 0%,100% { transform:scale(1); } 50% { transform:scale(1.035); } }
        @keyframes tv-artwork-drift { 0%,100% { transform:scale(1); } 50% { transform:scale(1.035); } }
        @keyframes tv-artwork-shine { 0%,40% { transform:translateX(-160%) skewX(-18deg); opacity:0; } 46% { opacity:.45; } 64% { transform:translateX(480%) skewX(-18deg); opacity:.25; } 70%,100% { transform:translateX(480%) skewX(-18deg); opacity:0; } }
        @keyframes tv-sun-orbit { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
        @keyframes tv-ticket-change { 0% { transform:scale(.82); opacity:.35; } 65% { transform:scale(1.035); opacity:1; } 100% { transform:scale(1); opacity:1; } }
        @media (prefers-reduced-motion:no-preference) {
          .tv-jackpot-board-artwork .tv-jackpot-art { animation:tv-artwork-drift 14s ease-in-out infinite; }
          .tv-jackpot-board-artwork::before { animation:tv-artwork-shine 8s ease-in-out infinite; }
          .tv-ticket-circle::before { animation:tv-sun-orbit 14s linear infinite; }
          .tv-ticket-circle { animation:tv-ticket-pulse 2.4s ease-in-out infinite; }
          .tv-ticket-number { animation:tv-ticket-change .45s ease-out both; transform-origin:center; }
          .tv-board-stack { animation:tv-screen-enter .45s ease-out both; }
        }
        @keyframes tv-screen-enter { from { opacity:.4; transform:scale(.985); } to { opacity:1; transform:scale(1); } }
        [data-live-status="delayed"] .tv-jackpot-art,
        [data-live-status="delayed"] .tv-jackpot-board::before,
        [data-live-status="delayed"] .tv-ticket-circle,
        [data-live-status="delayed"] .tv-ticket-circle::before { animation-play-state:paused; }
        @media (max-width:900px) { .tv-board-stack { gap:6px; } }
      `}</style>
    </div>
  );
}

function DisplayBoard({ slot }: { slot: TvDisplaySlot }) {
  const [imageFailed, setImageFailed] = useState(false);
  const hasArtwork = Boolean(slot.gameImage) && !imageFailed;

  return <article className={`tv-jackpot-board${hasArtwork ? " tv-jackpot-board-artwork" : ""}`} aria-label={`${slot.gameName} display ${slot.slotNumber}`} data-display-id={slot.id}>
    {hasArtwork ? (
      <Image
        className="tv-jackpot-art"
        style={{ objectFit: "cover", objectPosition: "center" }}
        src={slot.gameImage as string}
        alt={`${slot.gameName} artwork`}
        fill
        sizes="10vw"
        unoptimized
        priority
        onError={() => setImageFailed(true)}
      />
    ) : (
      <div className="tv-image-unavailable" role="img" aria-label={`${slot.gameName} image not available`}>
        Image not available
      </div>
    )}
    <div className="tv-top-corner tv-top-corner-center" aria-label={`Display ${slot.slotNumber}`}>{slot.slotNumber}</div>
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
      <div className="tv-ticket-face"><span key={value} className="tv-ticket-number" style={numberStyle}>{value}</span></div>
    </div>
    <span className="tv-ticket-label">{label}</span>
  </div>;
}
