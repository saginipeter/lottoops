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

interface RemoveBackstockPackModalProps {
  pack: Pack | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function RemoveBackstockPackModal({
  pack,
  isOpen,
  onClose,
  onSuccess,
}: RemoveBackstockPackModalProps) {
  const [removalReason, setRemovalReason] = useState<"RETURNED" | "LOST" | "OTHER">("RETURNED");
  const [removalReasonText, setRemovalReasonText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleRemove() {
    try {
      setError("");

      if (!pack) {
        setError("No pack selected.");
        return;
      }

      if (removalReason === "OTHER" && !removalReasonText.trim()) {
        setError("Please provide a reason for OTHER.");
        return;
      }

      setLoading(true);

      const res = await fetch("/api/packs/back-stock/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packId: pack.id,
          removalReason,
          removalReasonText: removalReasonText || undefined,
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
      setRemovalReason("RETURNED");
      setRemovalReasonText("");
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
          <DialogTitle>Remove Pack from Back Stock</DialogTitle>
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
                  <p className="font-semibold text-yellow-700">Back Stock</p>
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
                  borderColor: removalReason === "RETURNED" ? "#9333ea" : "#e5e7eb",
                  backgroundColor: removalReason === "RETURNED" ? "#f3e8ff" : "#ffffff",
                }}>
                <input
                  type="radio"
                  name="reason"
                  value="RETURNED"
                  checked={removalReason === "RETURNED"}
                  onChange={() => setRemovalReason("RETURNED")}
                  className="mt-1 h-4 w-4"
                />
                <div>
                  <div className="font-medium">Returned</div>
                  <div className="text-sm text-gray-600">Pack was returned by customer</div>
                </div>
              </label>

              <label className="flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-all"
                style={{
                  borderColor: removalReason === "LOST" ? "#9333ea" : "#e5e7eb",
                  backgroundColor: removalReason === "LOST" ? "#f3e8ff" : "#ffffff",
                }}>
                <input
                  type="radio"
                  name="reason"
                  value="LOST"
                  checked={removalReason === "LOST"}
                  onChange={() => setRemovalReason("LOST")}
                  className="mt-1 h-4 w-4"
                />
                <div>
                  <div className="font-medium">Lost</div>
                  <div className="text-sm text-gray-600">Pack is lost or unaccounted for</div>
                </div>
              </label>

              <label className="flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-all"
                style={{
                  borderColor: removalReason === "OTHER" ? "#9333ea" : "#e5e7eb",
                  backgroundColor: removalReason === "OTHER" ? "#f3e8ff" : "#ffffff",
                }}>
                <input
                  type="radio"
                  name="reason"
                  value="OTHER"
                  checked={removalReason === "OTHER"}
                  onChange={() => setRemovalReason("OTHER")}
                  className="mt-1 h-4 w-4"
                />
                <div>
                  <div className="font-medium">Other</div>
                  <div className="text-sm text-gray-600">Specify another reason</div>
                </div>
              </label>
            </div>
          </div>

          {/* Other Reason Text */}
          {removalReason === "OTHER" && (
            <div>
              <label className="block text-sm font-medium mb-2">
                Describe the reason *
              </label>
              <textarea
                value={removalReasonText}
                onChange={(e) => setRemovalReasonText(e.target.value)}
                placeholder="Explain why this pack is being removed from inventory..."
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
