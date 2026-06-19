"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { games, packs } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { formatCurrency } from "@/lib/utils";
import { AlertCircle, CheckCircle2 } from "lucide-react";

export function ReceiveForm() {
  const router = useRouter();
  const [gameId, setGameId] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [cost, setCost] = useState("");
  const [duplicateError, setDuplicateError] = useState(false);
  const [success, setSuccess] = useState(false);

  const selectedGame = games.find((g) => g.id === gameId);
  const retailValue = selectedGame
    ? selectedGame.price * selectedGame.ticketsPerPack
    : 0;

  function checkDuplicate(serial: string) {
    return packs.some((p) => p.serialNumber === serial);
  }

  function handleSerialChange(value: string) {
    setSerialNumber(value);
    setDuplicateError(value.trim() !== "" && checkDuplicate(value.trim()));
    setSuccess(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!serialNumber.trim() || checkDuplicate(serialNumber.trim())) {
      setDuplicateError(true);
      return;
    }
    // In the real app this posts to the API and creates the pack as Back Stock.
    setSuccess(true);
    setSerialNumber("");
    setGameId("");
    setCost("");
    setTimeout(() => router.push("/inventory"), 900);
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-3 gap-6">
      <Panel className="col-span-2 p-6">
        <div className="space-y-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text">
              Game
            </label>
            <select
              value={gameId}
              onChange={(e) => setGameId(e.target.value)}
              required
              className="w-full rounded-md border border-border bg-surface-soft px-3 py-2.5 text-sm text-text focus:outline-none"
            >
              <option value="" disabled>
                Select a game
              </option>
              {games.map((g) => (
                <option key={g.id} value={g.id}>
                  #{g.gameNumber} — {g.name} ({formatCurrency(g.price)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-text">
              Serial number
            </label>
            <input
              type="text"
              value={serialNumber}
              onChange={(e) => handleSerialChange(e.target.value)}
              placeholder="e.g. 2739-0334219"
              required
              className="w-full rounded-md border border-border bg-surface-soft px-3 py-2.5 font-mono text-sm text-text placeholder:text-text-tertiary focus:outline-none"
            />
            {duplicateError && (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-danger">
                <AlertCircle size={13} />
                This serial number is already in the system. Check the pack before receiving it again.
              </p>
            )}
            {success && (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-success">
                <CheckCircle2 size={13} />
                Pack received into back stock.
              </p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-text">
              Pack cost
            </label>
            <input
              type="number"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              placeholder="0.00"
              step="0.01"
              min="0"
              required
              className="w-full rounded-md border border-border bg-surface-soft px-3 py-2.5 font-mono text-sm text-text placeholder:text-text-tertiary focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.push("/inventory")}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={duplicateError}>
              Receive pack
            </Button>
          </div>
        </div>
      </Panel>

      <Panel className="p-6">
        <h3 className="text-sm font-semibold text-text">
          Pack summary
        </h3>
        <div className="perf-divider mt-4" />
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-text-secondary">Tickets per pack</dt>
            <dd className="font-mono text-text">
              {selectedGame ? selectedGame.ticketsPerPack : "—"}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-text-secondary">Price per ticket</dt>
            <dd className="font-mono text-text">
              {selectedGame ? formatCurrency(selectedGame.price) : "—"}
            </dd>
          </div>
          <div className="flex justify-between border-t border-border pt-3">
            <dt className="text-text-secondary">Retail value</dt>
            <dd className="font-mono font-semibold text-accent-hover">
              {selectedGame ? formatCurrency(retailValue) : "—"}
            </dd>
          </div>
        </dl>
        <p className="mt-5 text-xs leading-relaxed text-text-tertiary">
          The pack is saved as back stock once received. Activate it to a display slot when you&rsquo;re ready to put it on the board.
        </p>
      </Panel>
    </form>
  );
}
