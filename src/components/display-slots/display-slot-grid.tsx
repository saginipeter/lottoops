"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageToolbar } from "@/components/ui/page-toolbar";
import { StatusBar } from "@/components/ui/status-bar";
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
  const [search, setSearch] = useState("");
  const [viewFilter, setViewFilter] = useState<"ALL" | "ACTIVE" | "EMPTY">("ALL");

  const activeCount = slots.filter((slot) => Boolean(slot.pack)).length;
  const emptyCount = slots.length - activeCount;

  const filteredSlots = useMemo(() => {
    const term = search.toLowerCase();

    return slots.filter((slot) => {
      if (viewFilter === "ACTIVE" && !slot.pack) return false;
      if (viewFilter === "EMPTY" && slot.pack) return false;

      if (!term) return true;

      const gameName = slot.pack?.game?.name?.toLowerCase() ?? "";
      const gameNumber = String(slot.pack?.gameNumber ?? "").toLowerCase();
      const packNumber = String(slot.pack?.packNumber ?? "").toLowerCase();
      const slotNumber = String(slot.slotNumber).toLowerCase();

      return (
        gameName.includes(term) ||
        gameNumber.includes(term) ||
        packNumber.includes(term) ||
        slotNumber.includes(term)
      );
    });
  }, [slots, search, viewFilter]);

  if (slots.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
        <p className="text-sm font-medium text-gray-700">No display slots found.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageToolbar
        left={
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-3 top-2.5 text-text-tertiary" size={16} />
            <input
              className="h-8 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              placeholder="Search display, game, or pack"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        }
        center={
          <div className="flex items-center gap-1">
            <Button
              size="xs"
              variant={viewFilter === "ALL" ? "secondary" : "ghost"}
              onClick={() => setViewFilter("ALL")}
            >
              All
            </Button>
            <Button
              size="xs"
              variant={viewFilter === "ACTIVE" ? "secondary" : "ghost"}
              onClick={() => setViewFilter("ACTIVE")}
            >
              Active
            </Button>
            <Button
              size="xs"
              variant={viewFilter === "EMPTY" ? "secondary" : "ghost"}
              onClick={() => setViewFilter("EMPTY")}
            >
              Empty
            </Button>
          </div>
        }
        right={<span className="text-xs text-text-tertiary">{filteredSlots.length} visible</span>}
      />

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filteredSlots.map((slot) => (
            <DisplaySlotCard key={slot.id} slot={slot} />
          ))}
        </div>
      </div>

      <StatusBar
        left={<span>Total Displays: {slots.length}</span>}
        center={<span>Active: {activeCount} | Empty: {emptyCount}</span>}
        right={
          <Button variant="outline" size="xs" disabled>
            Bulk Clear Disabled
          </Button>
        }
      />
    </div>
  );
}