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

interface RemoveActivePackModalProps {
  pack: Pack | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  slots: Array<{ id: string; slotNumber: string; occupied: boolean }>;
}

export function RemoveActivePackModal({
  pack,
  isOpen,
  onClose,
  onSuccess,
  slots,
}: RemoveActivePackModalProps) {
  const [activeRemovalReason, setActiveRemovalReason] = useState<"STOLEN" | "RETURNED" | "REASSIGNED" | "OTHER">("RETURNED");
  const [activeRemovalReasonText, setActiveRemovalReasonText] = useState("");
  const [reassignToSlotId, setReassignToSlotId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const availableSlots = slots.filter((s) => !s.occupied);

  async function handleRemove() {
    try {
      setError("");

      if (!pack) {
        setError("No pack selected.");
        return;
      }

      if (activeRemovalReason === "REASSIGNED" && !reassignToSlotId) {
        setError("Please select a target display for reassignment.");
        return;
      }

      if (activeRemovalReason === "OTHER" && !activeRemovalReasonText.trim()) {
        setError("Please provide a reason for OTHER.");
        return;
      }

      setLoading(true);

      const res = await fetch("/api/packs/active/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packId: pack.id,
          activeRemovalReason,
          activeRemovalReasonText: activeRemovalReasonText || undefined,
          reassignToSlotId: activeRemovalReason === "REASSIGNED" ? reassignToSlotId : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Unable to remove pack.");
        return;
      }

      onSuccess();
      onClose();
      
      // Reset form
      setActiveRemovalReason("RETURNED");
      setActiveRemovalReasonText("");
      setReassignToSlotId("");
    } catch (err) {
      console.error(err);
      setError("An error occurred while removing the pack.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Remove Active Pack</DialogTitle>
        </DialogHeader>

        {error && (
          <div className="flex gap-3 rounded-lg bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle size={20} className="flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-6">
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
                  <p className="font-semibold text-green-700">Active</p>
                </div>
              </div>
            </Panel>
          )}

          {/* Removal Reason */}
          <div>
            <label className="block text-sm font-medium mb-3">
              Reason for Removal *
            </label>
            <div className="space-y-3">
              <label className="flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-all"
                style={{
                  borderColor: activeRemovalReason === "STOLEN" ? "#9333ea" : "#e5e7eb",
                  backgroundColor: activeRemovalReason === "STOLEN" ? "#f3e8ff" : "#ffffff",
                }}>
                <input
                  type="radio"
                  name="reason"
                  value="STOLEN"
                  checked={activeRemovalReason === "STOLEN"}
                  onChange={() => setActiveRemovalReason("STOLEN")}
                  className="mt-1 h-4 w-4"
                />
                <div>
                  <div className="font-medium">Stolen</div>
                  <div className="text-sm text-gray-600">Pack was stolen from display</div>
                </div>
              </label>

              <label className="flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-all"
                style={{
                  borderColor: activeRemovalReason === "RETURNED" ? "#9333ea" : "#e5e7eb",
                  backgroundColor: activeRemovalReason === "RETURNED" ? "#f3e8ff" : "#ffffff",
                }}>
                <input
                  type="radio"
                  name="reason"
                  value="RETURNED"
                  checked={activeRemovalReason === "RETURNED"}
                  onChange={() => setActiveRemovalReason("RETURNED")}
                  className="mt-1 h-4 w-4"
                />
                <div>
                  <div className="font-medium">Returned to State</div>
                  <div className="text-sm text-gray-600">Pack was returned to the state</div>
                </div>
              </label>

              <label className="flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-all"
                style={{
                  borderColor: activeRemovalReason === "REASSIGNED" ? "#9333ea" : "#e5e7eb",
                  backgroundColor: activeRemovalReason === "REASSIGNED" ? "#f3e8ff" : "#ffffff",
                }}>
                <input
                  type="radio"
                  name="reason"
                  value="REASSIGNED"
                  checked={activeRemovalReason === "REASSIGNED"}
                  onChange={() => setActiveRemovalReason("REASSIGNED")}
                  className="mt-1 h-4 w-4"
                />
                <div>
                  <div className="font-medium">Reassigned to Display</div>
                  <div className="text-sm text-gray-600">Move pack to another display number</div>
                </div>
              </label>

              <label className="flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-all"
                style={{
                  borderColor: activeRemovalReason === "OTHER" ? "#9333ea" : "#e5e7eb",
                  backgroundColor: activeRemovalReason === "OTHER" ? "#f3e8ff" : "#ffffff",
                }}>
                <input
                  type="radio"
                  name="reason"
                  value="OTHER"
                  checked={activeRemovalReason === "OTHER"}
                  onChange={() => setActiveRemovalReason("OTHER")}
                  className="mt-1 h-4 w-4"
                />
                <div>
                  <div className="font-medium">Other</div>
                  <div className="text-sm text-gray-600">Specify another reason</div>
                </div>
              </label>
            </div>
          </div>

          {/* Reassignment Display Selection */}
          {activeRemovalReason === "REASSIGNED" && (
            <div>
              <label className="block text-sm font-medium mb-2">
                Reassign to Display # *
              </label>
              {availableSlots.length > 0 ? (
                <select
                  value={reassignToSlotId}
                  onChange={(e) => setReassignToSlotId(e.target.value)}
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
                  No available displays for reassignment.
                </div>
              )}
            </div>
          )}

          {/* Other Reason Text */}
          {activeRemovalReason === "OTHER" && (
            <div>
              <label className="block text-sm font-medium mb-2">
                Describe the reason *
              </label>
              <textarea
                value={activeRemovalReasonText}
                onChange={(e) => setActiveRemovalReasonText(e.target.value)}
                placeholder="Explain why this pack is being removed from display..."
                className="w-full rounded-lg border px-4 py-2"
                rows={3}
              />
            </div>
          )}
        </div>

        <div className="flex gap-3 justify-end pt-6">
          <DialogClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DialogClose>
          <Button
            onClick={handleRemove}
            disabled={loading}
            variant="destructive"
          >
            {loading && <Loader2 size={16} className="mr-2 animate-spin" />}
            Remove Pack
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
