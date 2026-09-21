"use client";

import { useEffect, useState } from "react";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";

interface Props {
  slotId: string;
}

interface BackStockPack {
  id: string;
  status: "BACK_STOCK" | "ACTIVE";
  gameNumber?: string | null;
  packNumber?: string | null;
  currentTicketNumber?: number | null;
  ticketQuantity?: number | null;
  firstOrLastTicket?: string | null;
  game: {
    name: string;
  };
}

type SellDirection = "FIRST" | "LAST";

export default function AssignPackDialog({
  slotId,
}: Props) {
  const [packs, setPacks] = useState<BackStockPack[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedPackId, setSelectedPackId] = useState<string | null>(null);
  const [direction, setDirection] = useState<SellDirection>("FIRST");

  useEffect(() => {
    if (!open) return;

    async function loadPacks() {
      const res = await fetch("/api/packs/back-stock?includeActive=true");
      const data = await res.json();

      if (!res.ok) {
        alert(data?.error || "Unable to load back stock packs.");
        setPacks([]);
        return;
      }

      setPacks(Array.isArray(data) ? data : []);
    }

    loadPacks();
  }, [open]);

  function selectPack(pack: BackStockPack) {
    setSelectedPackId(pack.id);
    setDirection(
      pack.status === "ACTIVE" && pack.firstOrLastTicket === "LAST"
        ? "LAST"
        : "FIRST"
    );
  }

  async function assign(pack: BackStockPack) {
    setLoading(true);

    const res = await fetch("/api/display-slots", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        slotId,
        packId: pack.id,
        firstOrLastTicket: direction,
      }),
    });

    if (res.ok) {
      setOpen(false);
      setSelectedPackId(null);
      setDirection("FIRST");
      window.location.reload();
    } else {
      const data = await res.json().catch(() => null);
      alert(data?.error || "Unable to assign pack.");
    }

    setLoading(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full">Assign Pack</Button>
      </DialogTrigger>

      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Select Pack to Assign to Display</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {packs.length === 0 && (
            <p className="text-sm text-gray-500">No back-stock or unassigned active packs available.</p>
          )}

          {packs.map((pack) => {
            const isSelected = selectedPackId === pack.id;
            const isBackStock = pack.status === "BACK_STOCK";

            return (
              <div
                key={pack.id}
                className={`border p-4 ${isSelected ? "border-blue-600 bg-blue-50" : ""}`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="font-semibold">{pack.game.name}</h3>
                    <p className="text-sm">Game #{pack.gameNumber ?? "N/A"}</p>
                    <p className="text-sm">Pack #{pack.packNumber ?? "N/A"}</p>
                    <p className="text-sm">{pack.ticketQuantity ?? 0} tickets</p>
                    <p className="text-xs text-gray-500">
                      Status: {isBackStock ? "Back Stock" : "Active Stock"}
                    </p>
                    {!isBackStock && (
                      <p className="text-xs text-gray-500">
                        Current ticket: {pack.currentTicketNumber ?? 0} · Sell from {pack.firstOrLastTicket === "LAST" ? "Last" : "First"}
                      </p>
                    )}
                  </div>
                  <Button disabled={loading} onClick={() => selectPack(pack)}>
                    {isSelected ? "Selected" : "Select"}
                  </Button>
                </div>

                {isSelected && isBackStock && (
                  <div className="mt-4 border-t pt-4">
                    <p className="mb-2 text-sm font-semibold">Selling order</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant={direction === "FIRST" ? "default" : "outline"}
                        onClick={() => setDirection("FIRST")}
                      >
                        Sell from First
                      </Button>
                      <Button
                        type="button"
                        variant={direction === "LAST" ? "default" : "outline"}
                        onClick={() => setDirection("LAST")}
                      >
                        Sell from Last
                      </Button>
                    </div>
                    <Button className="mt-3 w-full" disabled={loading} onClick={() => assign(pack)}>
                      {loading ? "Assigning..." : "Assign Pack"}
                    </Button>
                  </div>
                )}

                {isSelected && !isBackStock && (
                  <Button className="mt-3 w-full" disabled={loading} onClick={() => assign(pack)}>
                    {loading ? "Assigning..." : "Assign Active Pack"}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
