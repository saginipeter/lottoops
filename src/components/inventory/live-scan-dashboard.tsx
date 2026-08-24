"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Clock,
  History,
  MapPin,
  Radio,
  RefreshCw,
  Search,
  TrendingUp,
} from "lucide-react";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { ScanStatusDisplay } from "./scan-status-display";
import { SalesTracker } from "./sales-tracker";

interface ShiftData {
  id: string;
  status: string;
  openedAt: string;
  openedBy: { name: string };
  lines: Array<{
    id: string;
    packId: string;
    beginningTicket: number;
    endingTicket?: number | null;
    ticketsSold?: number | null;
    salesAmount?: number | string | null;
    pack?: {
      serialNumber?: string;
      game?: { name?: string; price?: number | string };
      currentTicketNumber?: number | null;
      ticketPrice?: number | null;
    };
  }>;
}

interface PackData {
  id: string;
  serialNumber: string;
  gameNumber: string;
  status: string;
  currentTicketNumber?: number;
  ticketQuantity?: number;
  ticketPrice?: number;
  slot?: { slotNumber: string };
  game: { name: string };
}

interface LiveScanDashboardProps {
  currentShift: ShiftData | null;
  activePacks: PackData[];
  terminalId: string;
  isOwner: boolean;
}

interface TicketHistoryResult {
  found: boolean;
  pack?: {
    serialNumber: string;
    gameNumber: string;
    gameName: string;
    status: string;
    slotNumber: string | null;
    currentTicketNumber: number | null;
    ticketQuantity: number | null;
  };
  lastActivity?: {
    action: string;
    detail: string;
    timestamp: string;
    performedBy: string;
  } | null;
  history?: Array<{
    id: string;
    action: string;
    detail: string;
    timestamp: string;
    performedBy: string;
  }>;
}

export function LiveScanDashboard({
  currentShift,
  activePacks,
  terminalId,
  isOwner,
}: LiveScanDashboardProps) {
  const router = useRouter();
  const [barcode, setBarcode] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [reversing, setReversing] = useState(false);
  const [lastScan, setLastScan] = useState<any>(null);
  const [sales, setSales] = useState<any[]>([]);
  const [shiftStats, setShiftStats] = useState({
    ticketsSold: 0,
    revenueTotal: 0,
    packsSold: 0,
  });
  const [autoRefreshActive, setAutoRefreshActive] = useState(true);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
  const [scanError, setScanError] = useState("");
  const [historyQuery, setHistoryQuery] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyResult, setHistoryResult] = useState<TicketHistoryResult | null>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);

  // Auto-refresh polling every 10 seconds
  useEffect(() => {
    if (!autoRefreshActive) return;

    const interval = setInterval(() => {
      router.refresh();
      setLastRefreshTime(new Date());
    }, 10000); // 10 seconds

    return () => clearInterval(interval);
  }, [autoRefreshActive, router]);

  useEffect(() => {
    if (currentShift?.lines) {
      const metrics = currentShift.lines.map((line) => {
        const beginning = Number(line.beginningTicket ?? 0);
        const current =
          line.pack?.currentTicketNumber === null || line.pack?.currentTicketNumber === undefined
            ? beginning
            : Number(line.pack.currentTicketNumber);
        const ending = Math.min(Math.max(current, 0), beginning);
        const ticketsSold = Math.max(beginning - ending, 0);
        const price = Number(line.pack?.ticketPrice ?? line.pack?.game?.price ?? 0);
        const salesAmount = ticketsSold * price;

        return {
          ...line,
          ticketsSold,
          salesAmount,
        };
      });

      const total = metrics.reduce((sum, line) => sum + line.salesAmount, 0);
      const ticketCount = metrics.reduce((sum, line) => sum + line.ticketsSold, 0);
      const packCount = metrics.filter((line) => line.ticketsSold > 0).length;

      setShiftStats({
        ticketsSold: ticketCount,
        revenueTotal: total,
        packsSold: packCount,
      });

      setSales(metrics.filter((line) => line.ticketsSold > 0).slice(0, 10));
    } else {
      setShiftStats({
        ticketsSold: 0,
        revenueTotal: 0,
        packsSold: 0,
      });
      setSales([]);
    }
  }, [currentShift]);

  useEffect(() => {
    scanInputRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        scanInputRef.current?.focus();
      }

      if (event.key === "Escape") {
        setBarcode("");
        setScanError("");
        scanInputRef.current?.focus();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  async function handleScan() {
    if (!barcode.trim() || scanError) return;

    try {
      setRefreshing(true);

      const res = await fetch("/api/packs/check-serial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serialNumber: barcode, liveScan: true, terminalId }),
      });

      const data = await res.json();

      if (res.ok) {
        setScanError("");
        setLastScan(data);
        setLastRefreshTime(new Date());
        router.refresh();
      } else {
        setScanError(data.error || "Pack not found");
      }

      setBarcode("");
    } catch (err) {
      console.error(err);
      setScanError("Error scanning pack");
    } finally {
      setRefreshing(false);
      requestAnimationFrame(() => scanInputRef.current?.focus());
    }
  }

  async function handleHistorySearch() {
    if (!historyQuery.trim()) return;

    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/tickets/history?ticket=${encodeURIComponent(historyQuery)}`);
      const data = await res.json();
      setHistoryResult(res.ok ? data : { found: false });
    } catch {
      setHistoryResult(null);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function handleRejectLastSale() {
    if (!lastScan?.id) {
      setScanError("No recent scan to reverse.");
      return;
    }

    const pin = window.prompt("Enter manager approval PIN to return this ticket");
    if (pin === null) return;
    if (!pin.trim()) {
      setScanError("PIN is required.");
      return;
    }

    try {
      setReversing(true);
      const res = await fetch("/api/packs/reverse-sale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packId: lastScan.id,
          pin: pin.trim(),
          shiftId: currentShift?.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setScanError(data.error || "Unable to reverse sale.");
        return;
      }

      setScanError("");
      setLastRefreshTime(new Date());
      router.refresh();
    } catch (error) {
      console.error(error);
      setScanError("Unable to reverse sale.");
    } finally {
      setReversing(false);
      scanInputRef.current?.focus();
    }
  }

  const shiftDuration = currentShift
    ? Math.floor(
        (new Date().getTime() - new Date(currentShift.openedAt).getTime()) /
          1000 /
          60
      )
    : 0;

  const hourlyRate = shiftStats.revenueTotal / Math.max(shiftDuration / 60, 1);

  return (
    <div className="grid min-h-0 grid-cols-1 gap-4 xl:grid-cols-[1.4fr_1fr]">
      <div className="space-y-4">
      {/* Auto-Refresh Control */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2">
        <div className="flex items-center gap-2">
          <RefreshCw size={14} className="text-text-secondary" />
          <span className="text-xs text-text-secondary">
            Auto-refresh: {autoRefreshActive ? "ON (10s)" : "OFF"}
          </span>
          {lastRefreshTime && (
            <span className="text-xs text-text-tertiary">
              Last: {lastRefreshTime.toLocaleTimeString()}
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setAutoRefreshActive(!autoRefreshActive)}
        >
          {autoRefreshActive ? "Pause" : "Resume"}
        </Button>
      </div>

      {/* Shift Info Header */}
      {currentShift ? (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Panel className="p-3">
            <div className="mb-1.5 flex items-center gap-2">
              <Clock size={16} className="text-text-secondary" />
              <span className="text-[11px] font-medium text-text-tertiary">
                SHIFT OPEN
              </span>
            </div>
            <div className="text-xl font-bold text-text">
              {shiftDuration} min
            </div>
            <p className="mt-1 text-[11px] text-text-tertiary">
              Opened by {currentShift.openedBy.name}
            </p>
          </Panel>

          <Panel className="p-3">
            <div className="mb-1.5 flex items-center gap-2">
              <TrendingUp size={16} className="text-text-secondary" />
              <span className="text-[11px] font-medium text-text-tertiary">REVENUE</span>
            </div>
            <div className="text-xl font-bold text-text">
              ${shiftStats.revenueTotal.toFixed(2)}
            </div>
            <p className="mt-1 text-[11px] text-text-tertiary">
              ${hourlyRate.toFixed(2)}/hour
            </p>
          </Panel>

          <Panel className="p-3">
            <div className="mb-1.5 flex items-center gap-2">
              <Radio size={16} className="text-text-secondary" />
              <span className="text-[11px] font-medium text-text-tertiary">
                TICKETS SOLD
              </span>
            </div>
            <div className="text-xl font-bold text-text">
              {shiftStats.ticketsSold}
            </div>
            <p className="mt-1 text-[11px] text-text-tertiary">
              {shiftStats.packsSold} packs
            </p>
          </Panel>

          <Panel className="p-3">
            <div className="mb-1.5 flex items-center gap-2">
              <span className="text-[11px] font-medium text-text-tertiary">
                ACTIVE PACKS
              </span>
            </div>
            <div className="text-xl font-bold text-text">
              {activePacks.length}
            </div>
            <p className="mt-1 text-[11px] text-text-tertiary">
              Available for sale
            </p>
          </Panel>
        </div>
      ) : (
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4 text-center">
          <p className="text-sm font-medium text-yellow-900">
            No active shift. Please open a shift first.
          </p>
        </div>
      )}

      {/* Barcode Input */}
      <Panel className={`p-4 ${scanError ? "border-2 border-red-600 bg-red-50" : ""}`}>
        <div className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium">Scan Ticket Barcode</span>
            <p className="mb-2 text-xs text-text-tertiary">
              Scan barcode to sell
            </p>
          </label>

          {scanError && (
            <div role="alert" className="flex items-center gap-2 rounded-md border-2 border-red-600 bg-red-600 px-3 py-3 text-sm font-bold text-white">
              <AlertTriangle size={20} aria-hidden="true" />
              <span>TICKET MISMATCH / SCAN BLOCKED: {scanError}</span>
            </div>
          )}

          <div className="flex gap-2">
            <input
              ref={scanInputRef}
              type="text"
              value={barcode}
              onChange={(e) => {
                setBarcode(e.target.value);
                if (scanError) setScanError("");
              }}
              onKeyPress={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleScan();
                }
              }}
              placeholder="Scan barcode to sell"
              className={`flex-1 rounded-md border-2 px-3 py-3 text-lg font-mono outline-none focus-visible:ring-2 focus-visible:ring-ring/40 ${scanError ? "border-red-600 bg-white" : "border-border"}`}
              autoFocus
            />
            <Button
              onClick={handleScan}
              disabled={refreshing || !barcode.trim() || Boolean(scanError)}
              className={scanError ? "bg-red-300 text-red-900" : ""}
            >
              {refreshing ? "Scanning..." : "Scan"}
            </Button>
          </div>

          {lastScan && (
            <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3">
              <p className="text-sm font-medium text-green-900">
                ✓ Pack Found: {lastScan.gameNumber}
              </p>
              {isOwner && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={handleRejectLastSale}
                  disabled={reversing}
                >
                  {reversing ? "Reversing..." : "Customer Rejected - Return to Display (PIN)"}
                </Button>
              )}
            </div>
          )}
        </div>
      </Panel>

      <Panel className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <History size={18} className="text-accent" />
          <div>
            <h3 className="text-base font-semibold">Ticket History</h3>
            <p className="text-xs text-text-tertiary">Search a ticket or full barcode</p>
          </div>
        </div>
        <div className="flex gap-2">
          <input
            value={historyQuery}
            onChange={(event) => setHistoryQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleHistorySearch();
              }
            }}
            placeholder="Enter ticket number"
            className="min-w-0 flex-1 rounded-md border-2 border-border px-3 py-3 font-mono text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            aria-label="Ticket number"
          />
          <Button onClick={handleHistorySearch} disabled={historyLoading || !historyQuery.trim()}>
            <Search size={16} />
            {historyLoading ? "Searching" : "Search"}
          </Button>
        </div>

        {historyResult && !historyResult.found && (
          <div role="status" className="mt-3 rounded-md border-2 border-red-300 bg-red-50 px-3 py-3 text-sm font-bold text-red-800">
            NO SUCH TICKET EXISTS IN DATABASE.
          </div>
        )}

        {historyResult?.found && historyResult.pack && (
          <div className="mt-3 grid gap-3 xl:grid-cols-[1.3fr_1fr]">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-text-tertiary">Lifecycle trail</span>
                <span className="text-xs text-text-tertiary">{historyResult.history?.length ?? 0} events</span>
              </div>
              <div className="space-y-1.5">
                {Array.from(historyResult.history ?? []).reverse().map((entry) => (
                  <div key={entry.id} className="flex items-start justify-between gap-3 border-b border-border/60 pb-1.5 text-xs">
                    <div className="min-w-0">
                      <p className="font-semibold text-text">{entry.action.replaceAll("_", " ")}</p>
                      <p className="truncate text-text-secondary">{entry.detail}</p>
                    </div>
                    <time className="shrink-0 text-right text-text-tertiary">
                      {new Date(entry.timestamp).toLocaleDateString()}<br />
                      {new Date(entry.timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                    </time>
                  </div>
                ))}
                {historyResult.history?.length === 0 && <p className="text-sm text-text-secondary">No recorded activity yet.</p>}
              </div>
            </div>
            <div className="rounded-md border border-border bg-surface-soft p-3">
              <p className="text-xs font-semibold uppercase text-text-tertiary">Last known location / status</p>
              <p className="mt-1 text-lg font-bold text-text">{historyResult.pack.status.replaceAll("_", " ")}</p>
              <p className="mt-1 flex items-center gap-1 text-sm text-text-secondary">
                <MapPin size={14} /> {historyResult.pack.slotNumber ? `Display ${historyResult.pack.slotNumber}` : "No display assigned"}
              </p>
              <p className="mt-2 text-xs text-text-tertiary">Pack {historyResult.pack.serialNumber} · Game {historyResult.pack.gameNumber}</p>
              {historyResult.lastActivity && (
                <p className="mt-2 border-t border-border pt-2 text-xs text-text-secondary">Last: {historyResult.lastActivity.action.replaceAll("_", " ")}</p>
              )}
            </div>
          </div>
        )}
      </Panel>
      </div>

      {/* Status Display and Sales Tracker */}
      <div className="grid min-h-0 grid-cols-1 gap-4">
        <ScanStatusDisplay
          activePacks={activePacks}
          currentShift={currentShift}
          onDataChange={() => {
            setLastRefreshTime(new Date());
            router.refresh();
          }}
        />
        <SalesTracker
          sales={sales}
          shiftStats={shiftStats}
        />
      </div>
    </div>
  );
}
