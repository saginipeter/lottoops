"use client";

import { useEffect, useState } from "react";
import { ChevronUp, ChevronDown, Zap } from "lucide-react";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";

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

interface ShiftData {
  id: string;
  status: string;
  openedAt: string;
}

interface ScanStatusDisplayProps {
  activePacks: PackData[];
  currentShift: ShiftData | null;
}

export function ScanStatusDisplay({
  activePacks,
  currentShift,
}: ScanStatusDisplayProps) {
  const [currentPackIndex, setCurrentPackIndex] = useState(0);
  const [completingPack, setCompletingPack] = useState<string | null>(null);

  const currentPack = activePacks[currentPackIndex];

  async function handleMarkCompleted() {
    if (!currentPack) return;

    try {
      setCompletingPack(currentPack.id);

      const res = await fetch("/api/packs/mark-completed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId: currentPack.id }),
      });

      if (res.ok) {
        // Move to next pack or refresh
        if (currentPackIndex < activePacks.length - 1) {
          setCurrentPackIndex(currentPackIndex + 1);
        }
        // Optionally reload to get fresh data
        setTimeout(() => window.location.reload(), 500);
      } else {
        alert("Failed to mark pack completed");
      }
    } catch (err) {
      console.error(err);
      alert("Error completing pack");
    } finally {
      setCompletingPack(null);
    }
  }

  const ticketProgress =
    currentPack && currentPack.ticketQuantity
      ? ((currentPack.currentTicketNumber || 1) / currentPack.ticketQuantity) *
        100
      : 0;

  return (
    <Panel className="space-y-6 p-6">
      <div>
        <h3 className="text-lg font-bold mb-4">Current Pack</h3>

        {currentPack ? (
          <div className="space-y-4">
            {/* Pack Header */}
            <div className="rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 p-4 border border-blue-100">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="text-xs font-medium text-blue-600 uppercase">
                    {currentPack.game.name}
                  </p>
                  <p className="text-2xl font-bold text-blue-900">
                    #{currentPack.serialNumber}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium text-blue-600">SLOT</p>
                  <p className="text-lg font-bold text-blue-900">
                    {currentPack.slot?.slotNumber || "—"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-blue-600">Ticket Price</p>
                  <p className="font-bold text-blue-900">
                    ${currentPack.ticketPrice || 0}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-blue-600">Total Tickets</p>
                  <p className="font-bold text-blue-900">
                    {currentPack.ticketQuantity || 0}
                  </p>
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Progress</span>
                <span className="text-sm font-bold text-blue-600">
                  {currentPack.currentTicketNumber || 1} /{" "}
                  {currentPack.ticketQuantity || 0}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(ticketProgress, 100)}%` }}
                />
              </div>
            </div>

            {/* Navigation Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPackIndex(Math.max(0, currentPackIndex - 1))}
                disabled={currentPackIndex === 0}
              >
                <ChevronUp size={16} className="mr-2" />
                Previous Pack
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPackIndex(Math.min(activePacks.length - 1, currentPackIndex + 1))}
                disabled={currentPackIndex === activePacks.length - 1}
              >
                <ChevronDown size={16} className="mr-2" />
                Next Pack
              </Button>
            </div>

            {/* Mark Completed Button */}
            <Button
              onClick={handleMarkCompleted}
              disabled={completingPack === currentPack.id}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
            >
              <Zap size={16} className="mr-2" />
              {completingPack === currentPack.id
                ? "Marking..."
                : "Mark as Completed"}
            </Button>
          </div>
        ) : (
          <div className="rounded-lg bg-gray-50 border border-dashed border-gray-300 p-8 text-center">
            <p className="text-sm text-gray-600">No active packs available</p>
            <p className="text-xs text-gray-500 mt-1">
              Activate a pack from backstock to begin
            </p>
          </div>
        )}
      </div>

      {/* Pack List */}
      {activePacks.length > 0 && (
        <div>
          <h4 className="text-sm font-bold mb-3">All Active Packs</h4>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {activePacks.map((pack, idx) => (
              <button
                key={pack.id}
                onClick={() => setCurrentPackIndex(idx)}
                className={`w-full text-left p-3 rounded-lg transition-colors ${
                  idx === currentPackIndex
                    ? "bg-blue-100 border border-blue-300"
                    : "bg-gray-50 border border-gray-200 hover:bg-gray-100"
                }`}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-xs font-medium text-gray-600">
                      {pack.game.name}
                    </p>
                    <p className="font-bold">#{pack.serialNumber}</p>
                  </div>
                  <span className="text-xs font-bold text-gray-600">
                    {pack.currentTicketNumber || 1}/{pack.ticketQuantity || 0}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}
