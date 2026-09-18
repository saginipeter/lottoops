"use client";

import { useState } from "react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import AssignPackDialog from "./assign-pack-dialog";
import { RemoveActivePackModal } from "@/components/inventory/remove-active-pack-modal";
import { getDisplayedCurrentTicket } from "@/lib/ticket-quantity";

interface SlotPack {
  id: string;
  status?: string | null;
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
  canManageDisplay,
  slots,
}: {
  slot: DisplaySlot;
  canManageDisplay: boolean;
  slots: Array<{ id: string; slotNumber: string; occupied: boolean }>;
}) {
  const [removeOpen, setRemoveOpen] = useState(false);

  if (!slot.pack) {
    return (
      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-text">Display {slot.slotNumber}</h2>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-text-secondary">
            Empty
          </span>
        </div>
        <div className="mt-4 text-center">
          <p className="mb-3 text-xs text-text-secondary">Ready for assignment</p>
          {canManageDisplay && <AssignPackDialog slotId={slot.id} />}
        </div>
      </div>
    );
  }

  const ticketQuantity = slot.pack.ticketQuantity ?? 0;
  const firstTicket = slot.pack.firstTicket ?? 0;
  const totalTickets = ticketQuantity > 0 ? ticketQuantity : firstTicket;
  const beginningTicket = firstTicket > 0 ? firstTicket : totalTickets;
  const currentTicketNumber = getDisplayedCurrentTicket({
    currentTicketNumber: slot.pack.currentTicketNumber ?? null,
    firstTicket: firstTicket > 0 ? firstTicket : null,
    ticketQuantity: ticketQuantity > 0 ? ticketQuantity : null,
  });
  const soldCount = Math.max(beginningTicket - currentTicketNumber, 0);
  const remaining = Math.max(currentTicketNumber, 0);
  const percent = totalTickets > 0 ? (remaining / totalTickets) * 100 : 0;

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex justify-between">
        <h2 className="font-bold text-text">Display {slot.slotNumber}</h2>
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
          {slot.pack.status ?? "ASSIGNED"}
        </span>
      </div>

      <div className="mt-3">
        <p className="font-semibold text-text">{slot.pack.game.name}</p>
        <p className="text-xs text-text-secondary">Game {slot.pack.gameNumber ?? "N/A"}</p>
        <p className="text-xs text-text-secondary">Pack {slot.pack.packNumber ?? "N/A"}</p>
      </div>

      <div className="mt-3 rounded-md border border-border bg-muted/30 p-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-text-tertiary">
          Current Scratch Card
        </p>
        <p className="text-3xl font-bold tracking-tight text-text">
          {currentTicketNumber}
        </p>
      </div>

      <div className="mt-4">
        <Progress value={percent} />
        <div className="mt-1.5 flex justify-between text-[11px] text-text-secondary">
          <span>{remaining} tickets remaining</span>
          <span>{ticketQuantity > 0 ? `${Math.round(percent)}%` : "0%"} left</span>
        </div>
      </div>

      {canManageDisplay && <div className="mt-4 grid grid-cols-2 gap-2">
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
          onClick={() => setRemoveOpen(true)}
        >
          Remove
        </Button>
      </div>}
      <RemoveActivePackModal
        pack={slot.pack as never}
        isOpen={removeOpen}
        onClose={() => setRemoveOpen(false)}
        onSuccess={() => window.location.reload()}
        slots={slots}
      />
    </div>
  );
}