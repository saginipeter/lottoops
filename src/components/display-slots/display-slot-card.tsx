"use client";

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
  if (!slot.pack) {
    return (
      <div className="rounded-xl border p-6">
        <h2 className="font-bold">Slot {slot.slotNumber}</h2>
        <div className="mt-8 text-center">
          <p className="mb-6">Empty Slot</p>
          <AssignPackDialog slotId={slot.id} />
        </div>
      </div>
    );
  }

  const ticketQuantity = slot.pack.ticketQuantity ?? 0;
  const firstTicket = slot.pack.firstTicket ?? 0;
  const currentTicketNumber = slot.pack.currentTicketNumber ?? firstTicket;
  const soldCount = Math.max(currentTicketNumber - firstTicket, 0);
  const remaining = Math.max(ticketQuantity - soldCount, 0);
  const percent = ticketQuantity > 0 ? (remaining / ticketQuantity) * 100 : 0;

  return (
    <div className="rounded-xl border p-6">
      <div className="flex justify-between">
        <h2 className="font-bold">Slot {slot.slotNumber}</h2>
        <span className="rounded bg-green-100 px-2">ACTIVE</span>
      </div>

      <div className="mt-5">
        <p className="font-semibold">{slot.pack.game.name}</p>
        <p>Game {slot.pack.gameNumber ?? "N/A"}</p>
        <p>Pack {slot.pack.packNumber ?? "N/A"}</p>
      </div>

      <div className="mt-6">
        <Progress value={percent} />
        <p className="mt-2">{remaining} tickets remaining</p>
      </div>

      <Button
        className="mt-6 w-full"
        onClick={() => {
          window.location.href = "/inventory/live-scan";
        }}
      >
        Scan Sale
      </Button>
    </div>
  );
}