"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Maximize2, Minimize2, RefreshCw, Tv } from "lucide-react";

type TvDisplaySlot = {
  id: string;
  slotNumber: string;
  gameName: string;
  gameNumber: string;
  gameImage?: string | null;
  ticketPrice: number;
  remaining: number;
  sold: number;
  quantity: number;
};

interface TvDisplayBoardProps {
  slots: TvDisplaySlot[];
  kioskMode: boolean;
  refreshSeconds: number;
}

export function TvDisplayBoard({
  slots,
  kioskMode,
  refreshSeconds,
}: TvDisplayBoardProps) {
  const router = useRouter();
  const [lastRefreshAt, setLastRefreshAt] = useState<Date>(new Date());
  const [now, setNow] = useState<Date>(new Date());
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    const refresh = setInterval(() => {
      setLastRefreshAt(new Date());
      router.refresh();
    }, refreshSeconds * 1000);

    return () => clearInterval(refresh);
  }, [refreshSeconds, router]);

  const summary = useMemo(() => {
    const totalRemaining = slots.reduce((sum, slot) => sum + slot.remaining, 0);
    const totalSold = slots.reduce((sum, slot) => sum + slot.sold, 0);
    return {
      totalRemaining,
      totalSold,
    };
  }, [slots]);

  const boardShell = kioskMode
    ? "min-h-screen bg-[#050816] p-6"
    : "rounded-xl border border-white/15 bg-[#050816] p-6";

  return (
    <div className={boardShell}>
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-cyan-500/20 px-3 py-1 text-xs font-medium text-cyan-200">
            <Tv size={14} />
            LIVE TV BOARD
          </div>
          <h2 className="mt-3 text-2xl font-semibold text-white">
            Scratch-Off Display
          </h2>
          <p className="mt-1 text-sm text-white/70">
            Auto-refreshing every {refreshSeconds}s · Last refresh{" "}
            {lastRefreshAt.toLocaleTimeString()}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-right">
            <div className="text-[11px] uppercase tracking-wide text-white/60">Time</div>
            <div className="text-sm font-semibold text-white">{now.toLocaleTimeString()}</div>
          </div>
          <Link
            href={kioskMode ? "/settings/tv-display" : "/settings/tv-display?kiosk=1"}
            className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20"
          >
            {kioskMode ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            {kioskMode ? "Exit Fullscreen" : "Fullscreen"}
          </Link>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-white/15 bg-white/10 p-4">
          <p className="text-xs text-white/60">Active Slots</p>
          <p className="mt-1 text-2xl font-semibold text-white">{slots.length}</p>
        </div>
        <div className="rounded-xl border border-white/15 bg-white/10 p-4">
          <p className="text-xs text-white/60">Tickets Remaining</p>
          <p className="mt-1 text-2xl font-semibold text-white">{summary.totalRemaining}</p>
        </div>
        <div className="rounded-xl border border-white/15 bg-white/10 p-4">
          <p className="text-xs text-white/60">Tickets Sold</p>
          <p className="mt-1 text-2xl font-semibold text-white">{summary.totalSold}</p>
        </div>
      </div>

      {slots.length === 0 ? (
        <div className="rounded-xl border border-white/20 bg-white/5 p-10 text-center">
          <div className="mb-3 inline-flex rounded-full bg-white/10 p-3 text-cyan-200">
            <RefreshCw size={18} />
          </div>
          <p className="text-lg font-semibold text-white">No active packs on display</p>
          <p className="mt-2 text-sm text-white/70">
            Assign active packs to display slots to populate the TV board.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {slots.map((slot) => {
            const progress =
              slot.quantity > 0 ? Math.max((slot.sold / slot.quantity) * 100, 0) : 0;
            return (
              <div
                key={slot.id}
                className="rounded-xl border border-white/15 bg-gradient-to-br from-white/15 to-white/5 p-5 text-white"
              >
                <div className="flex items-center justify-between">
                  <span className="rounded bg-emerald-500/20 px-2 py-1 text-xs font-medium text-emerald-200">
                    Slot {slot.slotNumber}
                  </span>
                  <span className="text-xs text-white/70">Game #{slot.gameNumber}</span>
                </div>

                <div className="mt-3 flex items-center gap-3">
                  {slot.gameImage && !brokenImages[slot.id] ? (
                    <img
                      src={slot.gameImage}
                      alt={slot.gameName}
                      className="h-14 w-14 rounded-lg border border-white/20 bg-white/10 object-cover"
                      onError={() =>
                        setBrokenImages((prev) => ({
                          ...prev,
                          [slot.id]: true,
                        }))
                      }
                    />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-white/20 bg-white/10 text-lg font-semibold text-cyan-200">
                      {slot.gameName.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <h3 className="text-xl font-semibold">{slot.gameName}</h3>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-white/10 p-3">
                    <div className="text-white/60">Price</div>
                    <div className="mt-1 font-semibold">${slot.ticketPrice.toFixed(2)}</div>
                  </div>
                  <div className="rounded-lg bg-white/10 p-3">
                    <div className="text-white/60">Remaining</div>
                    <div className="mt-1 font-semibold">{slot.remaining}</div>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="mb-1 flex justify-between text-xs text-white/70">
                    <span>Sold Progress</span>
                    <span>{progress.toFixed(0)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/15">
                    <div
                      className="h-2 rounded-full bg-cyan-400"
                      style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
