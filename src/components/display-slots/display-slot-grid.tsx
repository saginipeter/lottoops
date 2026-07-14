"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import DisplaySlotCard from "./display-slot-card";

interface DisplaySlotGridProps {
  slots: Array<{
    id: string;
    slotNumber: string;
    pack: {
      id: string;
      gameNumber?: string | null;
      packNumber?: string | null;
      firstTicket?: number | null;
      currentTicketNumber?: number | null;
      ticketQuantity?: number | null;
      game: {
        name: string;
      };
    } | null;
  }>;
}

export default function DisplaySlotGrid({
  slots,
}: DisplaySlotGridProps) {
  const [clearingAll, setClearingAll] = useState(false);

  const activeCount = slots.filter((slot) => Boolean(slot.pack)).length;
  const emptyCount = slots.length - activeCount;

  async function clearAllSlots() {
    const confirmed = window.confirm(
      "Clear all display slots? This will remove all current slot assignments."
    );
    if (!confirmed) return;

    try {
      setClearingAll(true);
      const res = await fetch("/api/display-slots", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ clearAll: true }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Unable to clear all slots.");
        return;
      }

      window.location.reload();
    } catch (error) {
      console.error(error);
      alert("Unable to clear all slots.");
    } finally {
      setClearingAll(false);
    }
  }

  if (slots.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
        <p className="text-sm font-medium text-gray-700">No display slots found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-surface p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-surface-soft px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-text-tertiary">Total</p>
              <p className="text-lg font-semibold text-text">{slots.length}</p>
            </div>
            <div className="rounded-lg bg-emerald-50 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-emerald-700">Active</p>
              <p className="text-lg font-semibold text-emerald-800">{activeCount}</p>
            </div>
            <div className="rounded-lg bg-gray-100 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-gray-600">Empty</p>
              <p className="text-lg font-semibold text-gray-700">{emptyCount}</p>
            </div>
          </div>

          <Button
            variant="outline"
            onClick={clearAllSlots}
            disabled={clearingAll || activeCount === 0}
          >
            {clearingAll ? "Clearing All..." : "Clear All Display Slots"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        {slots.map((slot) => (
          <DisplaySlotCard key={slot.id} slot={slot} />
        ))}
      </div>
    </div>
  );
}