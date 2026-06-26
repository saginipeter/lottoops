"use client";

import { useState } from "react";
import { Pack } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { getGame, formatCurrency } from "@/lib/utils";
import { AlertCircle } from "lucide-react";

interface ActivatePackFormProps {
  slotNumber: string;
  backStockPacks: Pack[];
  onActivate: (packId: string, startingTicketNumber: number) => void;
  onCancel: () => void;
}

export function ActivatePackForm({
  slotNumber,
  backStockPacks,
  onActivate,
  onCancel,
}: ActivatePackFormProps) {
  const [packId, setPackId] = useState("");
  const [startingTicket, setStartingTicket] = useState("");
  const [error, setError] = useState("");

  const selectedPack = backStockPacks.find((p) => p.id === packId);
  const selectedGame = selectedPack ? getGame(selectedPack.gameId) : undefined;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!selectedPack || !selectedGame) {
      setError("Select a pack to activate.");
      return;
    }

    const ticketNum = parseInt(startingTicket, 10);
    if (Number.isNaN(ticketNum) || ticketNum < 0) {
      setError("Enter a valid starting ticket number.");
      return;
    }

    // The starting ticket number is normally the top of a fresh pack
    // (ticketsPerPack - 1, since packs count down to 000), but a manager
    // can override this for a partially-sold pack moved from another slot.
    if (ticketNum >= selectedGame.ticketsPerPack) {
      setError(
        `${selectedGame.name} packs only go up to ${selectedGame.ticketsPerPack - 1}.`
      );
      return;
    }

    onActivate(selectedPack.id, ticketNum);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="rounded-md bg-surface-soft px-3 py-2.5 text-xs text-text-secondary">
        Activating to <span className="font-semibold text-text">slot {slotNumber}</span>
      </div>

      {error && (
        <div className="flex items-center gap-1.5 rounded-md bg-danger-soft px-3 py-2.5 text-xs text-danger-soft-text">
          <AlertCircle size={13} className="shrink-0" />
          {error}
        </div>
      )}

      <div>
        <label className="mb-1.5 block text-xs font-medium text-text-secondary">
          Back stock pack
        </label>
        {backStockPacks.length === 0 ? (
          <p className="rounded-md border border-border bg-surface-soft px-3 py-2.5 text-xs text-text-tertiary">
            No back stock packs available. Receive inventory first.
          </p>
        ) : (
          <select
            value={packId}
            onChange={(e) => {
              setPackId(e.target.value);
              // Default the starting ticket to a fresh pack's top number
              const pack = backStockPacks.find((p) => p.id === e.target.value);
              const game = pack ? getGame(pack.gameId) : undefined;
              if (game) setStartingTicket(String(game.ticketsPerPack - 1));
            }}
            className="w-full rounded-md border border-border bg-surface-soft px-3 py-2.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent/20"
          >
            <option value="">Select a pack</option>
            {backStockPacks.map((p) => {
              const game = getGame(p.gameId);
              if (!game) return null;
              return (
                <option key={p.id} value={p.id}>
                  #{game.gameNumber} — {game.name} · {p.serialNumber}
                </option>
              );
            })}
          </select>
        )}
      </div>

      {selectedGame && (
        <div>
          <label className="mb-1.5 block text-xs font-medium text-text-secondary">
            Starting ticket number
          </label>
          <input
            type="number"
            value={startingTicket}
            onChange={(e) => setStartingTicket(e.target.value)}
            min={0}
            max={selectedGame.ticketsPerPack - 1}
            className="w-full rounded-md border border-border bg-surface-soft px-3 py-2.5 font-mono text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
          <p className="mt-1 text-[11px] text-text-tertiary">
            Defaults to {selectedGame.ticketsPerPack - 1} for a fresh pack.
            Lower this if the pack already has tickets sold.
          </p>
        </div>
      )}

      {selectedGame && (
        <div className="rounded-md border border-border bg-surface-soft px-3 py-2.5">
          <div className="flex justify-between text-xs">
            <span className="text-text-secondary">Retail value remaining</span>
            <span className="font-mono font-medium text-text">
              {formatCurrency(
                (parseInt(startingTicket || "0", 10) + 1) * selectedGame.price
              )}
            </span>
          </div>
        </div>
      )}

      <div className="mt-1 flex justify-end gap-2.5">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={backStockPacks.length === 0}>
          Activate to slot {slotNumber}
        </Button>
      </div>
    </form>
  );
}