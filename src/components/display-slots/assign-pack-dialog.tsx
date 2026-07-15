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
  game: {
    name: string;
  };
}

export default function AssignPackDialog({
  slotId,
}: Props) {
  const [packs, setPacks] = useState<BackStockPack[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

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

  async function assign(packId: string) {
    setLoading(true);

    const res = await fetch("/api/display-slots", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        slotId,
        packId,
      }),
    });

    if (res.ok) {
      setOpen(false);
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
          <DialogTitle>Select Pack to Assign</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {packs.length === 0 && (
            <p className="text-sm text-gray-500">No back-stock or unassigned active packs available.</p>
          )}

          {packs.map((pack) => (
            <div
              key={pack.id}
              className="flex items-center justify-between rounded-lg border p-4"
            >
              <div>
                <h3 className="font-semibold">{pack.game.name}</h3>
                <p className="text-sm">Game #{pack.gameNumber ?? "N/A"}</p>
                <p className="text-sm">Pack #{pack.packNumber ?? "N/A"}</p>
                <p className="text-sm">{pack.ticketQuantity ?? 0} tickets</p>
                <p className="text-xs text-gray-500">
                  Status: {pack.status === "ACTIVE" ? "Active Stock" : "Back Stock"}
                </p>
                {pack.status === "ACTIVE" && (
                  <p className="text-xs text-gray-500">
                    Current ticket: {pack.currentTicketNumber ?? 0}
                  </p>
                )}
              </div>

              <Button disabled={loading} onClick={() => assign(pack.id)}>
                Assign
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}