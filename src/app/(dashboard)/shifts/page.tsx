"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { AlertCircle, CheckCircle2, Clock, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface Game {
  id: string;
  name: string;
  gameNumber: number;
  price: number;
  ticketsPerPack: number;
}

interface DisplaySlot {
  id: string;
  slotNumber: number;
  gameId: string;
  game: Game;
  packId: string | null;
  status: "EMPTY" | "OCCUPIED" | "RESERVED";
  pack?: {
    id: string;
    serialNumber: string;
  };
}

export default function OpenShiftPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [games, setGames] = useState<Game[]>([]);
  const [displaySlots, setDisplaySlots] = useState<DisplaySlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const [startingTicketNumber, setStartingTicketNumber] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Load games and display slots
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);

        // Fetch games
        const gamesRes = await fetch("/api/games");
        if (!gamesRes.ok) throw new Error("Failed to load games");
        const gamesData = await gamesRes.json();
        setGames(gamesData.games || []);

        // Fetch display slots
        const slotsRes = await fetch("/api/display-slots");
        if (!slotsRes.ok) throw new Error("Failed to load display slots");
        const slotsData = await slotsRes.json();
        setDisplaySlots(slotsData.slots || []);

        // Auto-select first available slot
        const availableSlot = slotsData.slots?.find(
          (slot: DisplaySlot) => slot.status === "EMPTY" || slot.status === "RESERVED"
        );
        if (availableSlot) {
          setSelectedSlot(availableSlot.id);
        }
      } catch (err) {
        console.error("Error loading data:", err);
        setError("Failed to load data. Please refresh the page.");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const handleOpenShift = async () => {
    if (!selectedSlot) {
      setError("Please select a display slot to open.");
      return;
    }

    if (!startingTicketNumber || parseInt(startingTicketNumber) < 0) {
      setError("Please enter a valid starting ticket number.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/shifts/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slotId: selectedSlot,
          startingTicketNumber: parseInt(startingTicketNumber),
          notes: notes.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to open shift");
      }

      setSuccess(true);
      
      // Redirect to shift dashboard after short delay
      setTimeout(() => {
        router.push(`/shifts/${data.shiftId}`);
      }, 2000);
    } catch (err) {
      console.error("Error opening shift:", err);
      setError(err instanceof Error ? err.message : "Failed to open shift");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex items-center gap-3 text-text-secondary">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading display slots...
        </div>
      </div>
    );
  }

  const availableSlots = displaySlots.filter(
    (slot) => slot.status === "EMPTY" || slot.status === "RESERVED"
  );

  const selectedSlotData = displaySlots.find((s) => s.id === selectedSlot);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/shifts"
          className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-text transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to shifts
        </Link>
        <h1 className="text-2xl font-bold text-text">Open a Shift</h1>
        <p className="text-text-secondary mt-1">
          Start a new shift by selecting a display slot and entering the starting ticket number.
        </p>
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-2 rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger-soft-text">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div className="mb-6 flex items-center gap-2 rounded-lg bg-success-soft px-4 py-3 text-sm text-success-soft-text">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Shift opened successfully! Redirecting...
        </div>
      )}

      <div className="grid gap-6">
        {/* Display Slot Selection */}
        <Panel className="p-6">
          <h2 className="text-sm font-semibold text-text mb-4">
            1. Select a display slot
          </h2>
          
          {availableSlots.length === 0 ? (
            <div className="rounded-lg bg-warning-soft p-4 text-sm text-warning-soft-text">
              No available display slots. Please close an existing shift or add more slots.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {availableSlots.map((slot) => (
                <button
                  key={slot.id}
                  onClick={() => setSelectedSlot(slot.id)}
                  className={clsx(
                    "rounded-lg border-2 p-4 text-center transition-all",
                    selectedSlot === slot.id
                      ? "border-accent bg-accent/5 ring-2 ring-accent/20"
                      : "border-border hover:border-accent/50 hover:bg-surface-soft"
                  )}
                >
                  <div className="text-lg font-bold text-text">
                    #{slot.slotNumber}
                  </div>
                  <div className="mt-1 text-xs text-text-secondary">
                    {slot.game?.name || "Empty"}
                  </div>
                  <div className="mt-1 text-[10px] uppercase tracking-wide text-text-tertiary">
                    {slot.status}
                  </div>
                </button>
              ))}
            </div>
          )}
        </Panel>

        {/* Shift Details */}
        <Panel className="p-6">
          <h2 className="text-sm font-semibold text-text mb-4">
            2. Enter shift details
          </h2>

          <div className="space-y-4">
            {/* Selected Slot Info */}
            {selectedSlotData && (
              <div className="rounded-lg bg-surface-soft p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs text-text-secondary">Selected Slot</span>
                    <div className="font-semibold text-text">
                      #{selectedSlotData.slotNumber}
                    </div>
                    <div className="text-sm text-text-secondary">
                      {selectedSlotData.game?.name || "No game assigned"}
                    </div>
                  </div>
                  {selectedSlotData.game && (
                    <div className="text-right">
                      <span className="text-xs text-text-secondary">Ticket Price</span>
                      <div className="font-mono font-semibold text-text">
                        {formatCurrency(selectedSlotData.game.price)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Starting Ticket Number */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-text-secondary">
                Starting ticket number *
              </label>
              <input
                type="number"
                value={startingTicketNumber}
                onChange={(e) => setStartingTicketNumber(e.target.value)}
                placeholder="e.g., 1000"
                min="0"
                className="w-full rounded-md border border-border bg-surface-soft px-3 py-2.5 font-mono text-sm text-text placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent/20"
              />
              <p className="mt-1 text-xs text-text-tertiary">
                The first ticket number on the roll for this shift.
              </p>
            </div>

            {/* Notes */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-text-secondary">
                Notes (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any notes about this shift..."
                rows={3}
                className="w-full rounded-md border border-border bg-surface-soft px-3 py-2.5 text-sm text-text placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent/20"
              />
            </div>
          </div>
        </Panel>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <Button
            variant="secondary"
            className="flex-1 justify-center"
            onClick={() => router.push("/shifts")}
            disabled={saving || success}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            className="flex-1 justify-center"
            onClick={handleOpenShift}
            disabled={saving || success || !selectedSlot || !startingTicketNumber}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Opening shift...
              </>
            ) : (
              <>
                <Clock className="h-4 w-4" />
                Open Shift
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// Utility function for clsx
function clsx(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}