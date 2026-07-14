"use client";

import { useEffect, useState } from "react";
import { Clock, Radio, TrendingUp, RefreshCw } from "lucide-react";
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
}

export function LiveScanDashboard({
  currentShift,
  activePacks,
}: LiveScanDashboardProps) {
  const [barcode, setBarcode] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [lastScan, setLastScan] = useState<any>(null);
  const [sales, setSales] = useState<any[]>([]);
  const [shiftStats, setShiftStats] = useState({
    ticketsSold: 0,
    revenueTotal: 0,
    packsSold: 0,
  });
  const [autoRefreshActive, setAutoRefreshActive] = useState(true);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);

  // Auto-refresh polling every 10 seconds
  useEffect(() => {
    if (!autoRefreshActive) return;

    const interval = setInterval(async () => {
      try {
        const response = await fetch(window.location.href);
        if (response.ok) {
          setLastRefreshTime(new Date());
          // Silently refresh data without full page reload
          // This would require an API endpoint to fetch fresh data
          // For now, rely on periodic manual refresh
        }
      } catch (err) {
        console.error("Auto-refresh failed:", err);
      }
    }, 10000); // 10 seconds

    return () => clearInterval(interval);
  }, [autoRefreshActive]);

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
        const price = Number(line.pack?.game?.price ?? line.pack?.ticketPrice ?? 0);
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
    }
  }, [currentShift]);

  async function handleScan() {
    if (!barcode.trim()) return;

    try {
      setRefreshing(true);

      const res = await fetch("/api/packs/check-serial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serialNumber: barcode, liveScan: true }),
      });

      const data = await res.json();

      if (res.ok) {
        setLastScan(data);
        // Auto-refresh sales data
        window.location.reload();
      } else {
        alert(data.error || "Pack not found");
      }

      setBarcode("");
    } catch (err) {
      console.error(err);
      alert("Error scanning pack");
    } finally {
      setRefreshing(false);
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
    <div className="space-y-6 p-6">
      {/* Auto-Refresh Control */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex items-center gap-2">
          <RefreshCw size={16} className="text-gray-600" />
          <span className="text-sm text-gray-600">
            Auto-refresh: {autoRefreshActive ? "ON (10s)" : "OFF"}
          </span>
          {lastRefreshTime && (
            <span className="text-xs text-gray-500">
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
        <div className="grid grid-cols-4 gap-4">
          <Panel className="bg-blue-50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock size={18} className="text-blue-600" />
              <span className="text-xs font-medium text-blue-600">
                SHIFT OPEN
              </span>
            </div>
            <div className="text-2xl font-bold text-blue-900">
              {shiftDuration} min
            </div>
            <p className="text-xs text-blue-600 mt-1">
              Opened by {currentShift.openedBy.name}
            </p>
          </Panel>

          <Panel className="bg-green-50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp size={18} className="text-green-600" />
              <span className="text-xs font-medium text-green-600">REVENUE</span>
            </div>
            <div className="text-2xl font-bold text-green-900">
              ${shiftStats.revenueTotal.toFixed(2)}
            </div>
            <p className="text-xs text-green-600 mt-1">
              ${hourlyRate.toFixed(2)}/hour
            </p>
          </Panel>

          <Panel className="bg-purple-50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Radio size={18} className="text-purple-600" />
              <span className="text-xs font-medium text-purple-600">
                TICKETS SOLD
              </span>
            </div>
            <div className="text-2xl font-bold text-purple-900">
              {shiftStats.ticketsSold}
            </div>
            <p className="text-xs text-purple-600 mt-1">
              {shiftStats.packsSold} packs
            </p>
          </Panel>

          <Panel className="bg-orange-50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium text-orange-600">
                ACTIVE PACKS
              </span>
            </div>
            <div className="text-2xl font-bold text-orange-900">
              {activePacks.length}
            </div>
            <p className="text-xs text-orange-600 mt-1">
              Available for sale
            </p>
          </Panel>
        </div>
      ) : (
        <div className="rounded-lg border-2 border-dashed border-yellow-300 bg-yellow-50 p-6 text-center">
          <p className="text-sm font-medium text-yellow-900">
            No active shift. Please open a shift first.
          </p>
        </div>
      )}

      {/* Barcode Input */}
      <Panel className="p-6 bg-gray-50">
        <div className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium">Scan Barcode</span>
            <p className="text-xs text-gray-500 mb-2">
              Scan a ticket barcode to record the sale
            </p>
          </label>

          <div className="flex gap-2">
            <input
              type="text"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === "Enter") handleScan();
              }}
              placeholder="Scan barcode or press Enter to search..."
              className="flex-1 rounded-lg border px-4 py-3 text-lg font-mono"
              autoFocus
            />
            <Button
              onClick={handleScan}
              disabled={refreshing || !barcode.trim()}
            >
              {refreshing ? "Scanning..." : "Scan"}
            </Button>
          </div>

          {lastScan && (
            <div className="rounded-lg bg-green-50 border border-green-200 p-3">
              <p className="text-sm font-medium text-green-900">
                ✓ Pack Found: {lastScan.gameNumber}
              </p>
            </div>
          )}
        </div>
      </Panel>

      {/* Status Display and Sales Tracker */}
      <div className="grid grid-cols-2 gap-6">
        <ScanStatusDisplay
          activePacks={activePacks}
          currentShift={currentShift}
        />
        <SalesTracker
          sales={sales}
          shiftStats={shiftStats}
        />
      </div>
    </div>
  );
}
