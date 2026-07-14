"use client";

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
  if (slots.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
        <p className="text-sm font-medium text-gray-700">No display slots found.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
      {slots.map((slot) => (
        <DisplaySlotCard key={slot.id} slot={slot} />
      ))}
    </div>
  );
}