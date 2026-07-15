"use client";

import { useState } from "react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import AssignPackDialog from "./assign-pack-dialog";

interface SlotPack {
  id: string;
  gameNumber?: string | null;
  packNumber?: string | null;
  firstTicket?: number | null;
  currentTicketNumber?: number | null;
  ticketQuantity?: number | null;
  game: {
    name: string;
  };
}

interface DisplaySlot {
  id: string;
  slotNumber: string;
  pack: SlotPack | null;
}

export default function DisplaySlotCard({
  slot,
}: {
  slot: DisplaySlot;
}) {
  const [clearing, setClearing] = useState(false);

  async function clearSlot() {
    const confirmed = window.confirm(
      `Remove data from Slot ${slot.slotNumber}? This will unassign the pack from display.`
    );
    if (!confirmed) return;

    try {
      setClearing(true);
      const res = await fetch("/api/display-slots", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ slotId: slot.id }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Unable to clear slot.");
        return;
      }

      window.location.reload();
    } catch (error) {
      console.error(error);
      alert("Unable to clear slot.");
    } finally {
      setClearing(false);
    }
  }

  if (!slot.pack) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-text">Slot {slot.slotNumber}</h2>
          <span className="rounded-full bg-gray-100 px-2 py-1 text-[11px] font-medium text-gray-600">
            Empty
          </span>
        </div>
        <div className="mt-8 text-center">
          <p className="mb-6 text-sm text-text-secondary">Ready for assignment</p>
          <AssignPackDialog slotId={slot.id} />
        </div>
      </div>
    );
  }

  const ticketQuantity = slot.pack.ticketQuantity ?? 0;
  const firstTicket = slot.pack.firstTicket ?? 0;
  const totalTickets = ticketQuantity > 0 ? ticketQuantity : firstTicket;
  const beginningTicket = firstTicket > 0 ? firstTicket : totalTickets;
  const currentTicketNumber = slot.pack.currentTicketNumber ?? beginningTicket;
  const soldCount = Math.max(beginningTicket - currentTicketNumber, 0);
  const remaining = Math.max(totalTickets - soldCount, 0);
  const percent = totalTickets > 0 ? (remaining / totalTickets) * 100 : 0;

  return (
    <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-white p-6 shadow-sm">
      <div className="flex justify-between">
        <h2 className="font-bold text-text">Slot {slot.slotNumber}</h2>
        <span className="rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-700">
          ACTIVE
        </span>
      </div>

      <div className="mt-5">
        <p className="font-semibold text-text">{slot.pack.game.name}</p>
        <p className="text-sm text-text-secondary">Game {slot.pack.gameNumber ?? "N/A"}</p>
        <p className="text-sm text-text-secondary">Pack {slot.pack.packNumber ?? "N/A"}</p>
      </div>

      <div className="mt-4 rounded-lg border border-emerald-100 bg-white/80 p-3">
        <p className="text-xs font-medium uppercase tracking-wide text-emerald-700/80">
          Current Scratch Card
        </p>
        <p className="text-4xl font-extrabold tracking-tight text-emerald-700">
          {currentTicketNumber}
        </p>
      </div>

      <div className="mt-6">
        <Progress value={percent} />
        <div className="mt-2 flex justify-between text-xs text-text-secondary">
          <span>{remaining} tickets remaining</span>
          <span>{ticketQuantity > 0 ? `${Math.round(percent)}%` : "0%"} left</span>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-2">
        <Button
          className="w-full"
          onClick={() => {
            window.location.href = "/inventory/live-scan";
          }}
        >
          Scan Sale
        </Button>
        <Button
          className="w-full"
          variant="outline"
          onClick={clearSlot}
          disabled={clearing}
        >
          {clearing ? "Clearing..." : "Clear Slot"}
        </Button>
      </div>
    </div>
  );
}