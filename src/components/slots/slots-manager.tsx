"use client";

import { useState } from "react";
import { getDisplayBoard, getBackStockPacks, TOTAL_DISPLAY_SLOTS } from "@/lib/utils";
import { DisplaySlot } from "@/lib/types";
import { Drawer } from "@/components/ui/drawer";
import { SlotBoardCard } from "./slot-board-card";
import { ActivatePackForm } from "./activate-pack-form";

export function SlotsManager() {
  const [board, setBoard] = useState<DisplaySlot[]>(getDisplayBoard());
  const [backStock, setBackStock] = useState(getBackStockPacks());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeSlotNumber, setActiveSlotNumber] = useState<string | null>(null);

  const occupiedCount = board.filter((s) => s.pack && s.pack.status === "active").length;
  const soldOutCount = board.filter((s) => s.pack && s.pack.status === "sold-out").length;
  const emptyCount = board.filter((s) => !s.pack).length;

  function openActivateDrawer(slotNumber: string) {
    setActiveSlotNumber(slotNumber);
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setActiveSlotNumber(null);
  }

  function handleActivate(packId: string, startingTicketNumber: number) {
    const pack = backStock.find((p) => p.id === packId);
    if (!pack || !activeSlotNumber) return;

    const activatedPack = {
      ...pack,
      status: "active" as const,
      slotId: `slot-${parseInt(activeSlotNumber, 10)}`,
      currentTicketNumber: startingTicketNumber,
    };

    setBoard((prev) =>
      prev.map((slot) =>
        slot.slotNumber === activeSlotNumber
          ? { ...slot, pack: activatedPack }
          : slot
      )
    );
    setBackStock((prev) => prev.filter((p) => p.id !== packId));
    closeDrawer();
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-3 text-xs text-text-secondary">
        <span className="rounded-full bg-success-soft px-2.5 py-1 font-medium text-success-soft-text">
          {occupiedCount} active
        </span>
        {soldOutCount > 0 && (
          <span className="rounded-full bg-danger-soft px-2.5 py-1 font-medium text-danger-soft-text">
            {soldOutCount} sold out
          </span>
        )}
        <span className="rounded-full bg-surface-soft px-2.5 py-1 font-medium text-text-tertiary">
          {emptyCount} empty
        </span>
        <span className="ml-auto text-text-tertiary">
          {TOTAL_DISPLAY_SLOTS} slots on the board
        </span>
      </div>

      <div className="grid grid-cols-5 gap-3">
        {board.map((slot) => (
          <SlotBoardCard
            key={slot.slotNumber}
            slot={slot}
            onActivate={openActivateDrawer}
          />
        ))}
      </div>

      <Drawer
        open={drawerOpen}
        onClose={closeDrawer}
        title="Activate pack"
        subtitle="Move a back stock pack onto the display board"
      >
        {activeSlotNumber && (
          <ActivatePackForm
            slotNumber={activeSlotNumber}
            backStockPacks={backStock}
            onActivate={handleActivate}
            onCancel={closeDrawer}
          />
        )}
      </Drawer>
    </div>
  );
}