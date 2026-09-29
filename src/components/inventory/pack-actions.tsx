"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { getDisplayedTicketNumber } from "@/lib/tv-display";

interface PackActionsProps {
  pack: any;
}

export function PackActions({
  pack,
}: PackActionsProps) {
  const router = useRouter();
  const [savingTicket, setSavingTicket] = useState(false);
  const [movingDisplay, setMovingDisplay] = useState(false);
  const [markingSoldOut, setMarkingSoldOut] = useState(false);

  async function handleUpdateCurrentTicket() {
    if (pack.status !== "ACTIVE") {
      alert("Only ACTIVE packs can update current ticket.");
      return;
    }

    const current = getDisplayedTicketNumber(
      Number(pack.firstTicket ?? 1),
      Number(pack.currentTicketNumber ?? pack.ticketQuantity ?? 0),
      Number(pack.ticketQuantity ?? pack.game?.ticketsPerPack ?? 0),
      pack.firstOrLastTicket === "LAST" ? "LAST" : "FIRST",
    );
    const response = window.prompt("Enter the physical ticket number currently on the display", String(current));
    if (response === null) return;

    const value = Number(response);
    if (!Number.isInteger(value) || value < 0) {
      alert("Please enter a valid non-negative whole number.");
      return;
    }

    const reason = window.prompt("Enter the reason for this ticket correction (at least 6 characters)");
    if (reason === null || reason.trim().length < 6) {
      alert("A correction reason of at least 6 characters is required.");
      return;
    }

    try {
      setSavingTicket(true);
      const res = await fetch("/api/packs/update-ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId: pack.id, physicalTicketNumber: value, reason: reason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Unable to update current ticket.");
        return;
      }
      router.refresh();
    } catch (error) {
      console.error(error);
      alert("Unable to update current ticket.");
    } finally {
      setSavingTicket(false);
    }
  }

  async function handleMoveDisplay() {
    if (pack.status !== "ACTIVE") {
      alert("Only ACTIVE packs can be moved.");
      return;
    }

    try {
      setMovingDisplay(true);
      const slotsRes = await fetch("/api/display-slots");
      const slotsData = await slotsRes.json();
      if (!slotsRes.ok || !Array.isArray(slotsData)) {
        alert("Unable to load displays.");
        return;
      }

      const openSlots = slotsData
        .filter((slot: { id: string; slotNumber: string; packId: string | null }) => !slot.packId)
        .map((slot: { id: string; slotNumber: string }) => slot.slotNumber);

      if (openSlots.length === 0) {
        alert("No open displays available.");
        return;
      }

      const chosen = window.prompt(
        `Enter target display number.\nAvailable: ${openSlots.join(", ")}`
      );
      if (!chosen) return;

      const targetSlot = slotsData.find(
        (slot: { id: string; slotNumber: string; packId: string | null }) =>
          slot.slotNumber === chosen && !slot.packId
      );

      if (!targetSlot) {
        alert("Invalid or occupied display selected.");
        return;
      }

      const moveRes = await fetch("/api/packs/active/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packId: pack.id,
          activeRemovalReason: "REASSIGNED",
          reassignToSlotId: targetSlot.id,
        }),
      });
      const moveData = await moveRes.json();
      if (!moveRes.ok) {
        alert(moveData.error || "Unable to move pack.");
        return;
      }

      router.refresh();
    } catch (error) {
      console.error(error);
      alert("Unable to move pack.");
    } finally {
      setMovingDisplay(false);
    }
  }

  async function handleMarkSoldOut() {
    if (pack.status !== "ACTIVE") {
      alert("Only ACTIVE packs can be marked sold out.");
      return;
    }

    const confirmed = window.confirm("Mark this pack as sold out?");
    if (!confirmed) return;

    try {
      setMarkingSoldOut(true);
      const res = await fetch("/api/packs/mark-sold-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId: pack.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Unable to mark pack sold out.");
        return;
      }
      router.refresh();
    } catch (error) {
      console.error(error);
      alert("Unable to mark pack sold out.");
    } finally {
      setMarkingSoldOut(false);
    }
  }

  return (
    <Panel className="space-y-4 p-6">
      <Button className="w-full" onClick={handleUpdateCurrentTicket} disabled={savingTicket}>
        {savingTicket ? "Updating..." : "Update Remaining Ticket Count"}
      </Button>

      <Button
        variant="secondary"
        className="w-full"
        onClick={handleMoveDisplay}
        disabled={movingDisplay}
      >
        {movingDisplay ? "Moving..." : "Move Display"}
      </Button>

      <Button
        variant="destructive"
        className="w-full"
        onClick={handleMarkSoldOut}
        disabled={markingSoldOut}
      >
        {markingSoldOut ? "Marking..." : "Mark Sold Out"}
      </Button>
    </Panel>
  );
}
