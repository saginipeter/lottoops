"use client";

import { useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import type { Pack } from "@prisma/client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Panel } from "@/components/ui/panel";
import { InvoiceUpload } from "@/components/receive/invoice-upload";

interface ActivatePackModalProps {
  pack: Pack | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  slots: Array<{ id: string; slotNumber: string; occupied: boolean }>;
}

export function ActivatePackModal({
  pack,
  isOpen,
  onClose,
  onSuccess,
  slots,
}: ActivatePackModalProps) {
  const [activationNumber, setActivationNumber] = useState("");
  const [activationReceiptPhoto, setActivationReceiptPhoto] = useState("");
  const [firstOrLastTicket, setFirstOrLastTicket] = useState<"FIRST" | "LAST">("FIRST");
  const [selectedSlotId, setSelectedSlotId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const availableSlots = slots.filter((s) => !s.occupied);

  async function handleActivate() {
    try {
      setError("");

      if (!pack) {
        setError("No pack selected.");
        return;
      }

      if (!selectedSlotId) {
        setError("Please select a display.");
        return;
      }

      setLoading(true);

      const res = await fetch("/api/packs/back-stock/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packId: pack.id,
          slotId: selectedSlotId,
          activationNumber: activationNumber || undefined,
          activationReceiptPhoto: activationReceiptPhoto || undefined,
          firstOrLastTicket: firstOrLastTicket || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Unable to activate pack.");
        return;
      }

      onSuccess();
      onClose();
      
      // Reset form
      setActivationNumber("");
      setActivationReceiptPhoto("");
      setFirstOrLastTicket("FIRST");
      setSelectedSlotId("");
    } catch (err) {
      console.error(err);
      setError("An error occurred while activating the pack.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-2xl flex-col overflow-hidden p-4 sm:max-h-[calc(100dvh-2rem)] sm:w-full sm:p-6">
        <DialogHeader className="shrink-0">
          <DialogTitle>Activate Pack</DialogTitle>
        </DialogHeader>

        {error && (
          <div className="flex gap-3 rounded-lg bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle size={20} className="flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain pr-1">
          {/* Pack Info */}
          {pack && (
            <Panel className="p-4 bg-gray-50">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-gray-500">Serial #</p>
                  <p className="font-mono font-semibold">{pack.serialNumber}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Game #</p>
                  <p className="font-semibold">{pack.gameNumber || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Status</p>
                  <p className="font-semibold text-yellow-700">Back Stock</p>
                </div>
              </div>
            </Panel>
          )}

          {/* Activation Number */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Activation Number
            </label>
            <input
              type="text"
              value={activationNumber}
              onChange={(e) => setActivationNumber(e.target.value)}
              placeholder="e.g., ACT-2024-001"
              className="w-full rounded-lg border px-4 py-2"
            />
          </div>

          {/* Activation Receipt Photo */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Activation Receipt Photo
            </label>
            <InvoiceUpload
              value={activationReceiptPhoto}
              title="Upload Activation Receipt Photo"
              previewAlt="Activation receipt photo"
              errorMessage="Failed to upload activation receipt photo."
              onChange={setActivationReceiptPhoto}
            />
          </div>

          {/* First or Last Ticket */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Ticket Sell Order
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="firstOrLast"
                  value="FIRST"
                  checked={firstOrLastTicket === "FIRST"}
                  onChange={() => setFirstOrLastTicket("FIRST")}
                  className="h-4 w-4"
                />
                <span className="text-sm">Sell from First Ticket</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="firstOrLast"
                  value="LAST"
                  checked={firstOrLastTicket === "LAST"}
                  onChange={() => setFirstOrLastTicket("LAST")}
                  className="h-4 w-4"
                />
                <span className="text-sm">Sell from Last Ticket</span>
              </label>
            </div>
          </div>

          {/* Display Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Display # *
            </label>
            {availableSlots.length > 0 ? (
              <select
                value={selectedSlotId}
                onChange={(e) => setSelectedSlotId(e.target.value)}
                className="w-full rounded-lg border px-4 py-2"
              >
                <option value="">Select a display...</option>
                {availableSlots.map((slot) => (
                  <option key={slot.id} value={slot.id}>
                    Display {slot.slotNumber}
                  </option>
                ))}
              </select>
            ) : (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                No available displays. Manage your display inventory first.
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 justify-end gap-3 border-t border-border pt-4 sm:pt-6">
          <DialogClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DialogClose>
          <Button
            onClick={handleActivate}
            disabled={loading || !selectedSlotId}
          >
            {loading && <Loader2 size={16} className="mr-2 animate-spin" />}
            Activate Pack
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
