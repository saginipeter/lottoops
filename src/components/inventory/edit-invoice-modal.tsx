"use client";

import { useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Panel } from "@/components/ui/panel";

interface EditInvoiceModalProps {
  shipment: {
    id: string;
    invoiceNumber: string;
    shipmentConfirmationNumber?: string | null;
  } | null;
  packCount: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditInvoiceModal({
  shipment,
  packCount,
  isOpen,
  onClose,
  onSuccess,
}: EditInvoiceModalProps) {
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [confirmationNumber, setConfirmationNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loadedShipmentId, setLoadedShipmentId] = useState<string | null>(null);

  // Load the shipment's current values into the form once, when it changes.
  if (shipment && shipment.id !== loadedShipmentId) {
    setLoadedShipmentId(shipment.id);
    setInvoiceNumber(shipment.invoiceNumber);
    setConfirmationNumber(shipment.shipmentConfirmationNumber ?? "");
    setError("");
  }

  async function handleSave() {
    if (!shipment) return;

    if (!invoiceNumber.trim()) {
      setError("Invoice number is required.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const res = await fetch("/api/shipments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shipmentId: shipment.id,
          invoiceNumber: invoiceNumber.trim(),
          shipmentConfirmationNumber: confirmationNumber.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Unable to update invoice.");
        return;
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      setError("An error occurred while updating the invoice.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Correct Invoice</DialogTitle>
        </DialogHeader>

        {error && (
          <div className="flex gap-3 rounded-lg bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle size={20} className="flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-5">
          {shipment && (
            <Panel className="p-4 bg-gray-50">
              <p className="text-xs text-gray-500">
                Every pack under this invoice ({packCount}) will move with the correction.
              </p>
            </Panel>
          )}

          <div>
            <label className="mb-2 block text-sm font-medium">Invoice Tracking Number</label>
            <input
              className="w-full rounded-lg border border-gray-300 px-4 py-3"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="Enter correct invoice number"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Shipment Confirmation Number</label>
            <input
              className="w-full rounded-lg border border-gray-300 px-4 py-3"
              value={confirmationNumber}
              onChange={(e) => setConfirmationNumber(e.target.value)}
              placeholder="Enter confirmation number"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
            Save Correction
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
