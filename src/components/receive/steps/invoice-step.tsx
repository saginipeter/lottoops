"use client";

import { Calendar, Camera, FileText, Package, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { InvoiceUpload } from "../invoice-upload";
import type { ShipmentState } from "@/lib/types";

interface InvoiceStepProps {
  shipment: ShipmentState;
  setShipment: React.Dispatch<
    React.SetStateAction<ShipmentState>
  >;
  nextStep: () => void;
}

export function InvoiceStep({
  shipment,
  setShipment,
  nextStep,
}: InvoiceStepProps) {
  async function handleContinue() {
    try {
      const response = await fetch("/api/shipments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          invoiceNumber: shipment.invoiceNumber,
          invoicePhoto: shipment.invoicePhoto,
          expectedPacks: shipment.expectedPacks,
          receivedBy: shipment.receivedBy,
          shipmentDate: shipment.shipmentDate,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error);
        return;
      }

      setShipment((prev) => ({
        ...prev,
        id: data.id,
        scannedPacks: data.scannedPacks,
        status: data.status,
      }));

      nextStep();
    } catch (error) {
      console.error(error);
      alert("Unable to create shipment.");
    }
  }

  return (
    <div className="grid grid-cols-3 gap-6">
      {/* LEFT */}
      <div className="col-span-2 space-y-6">
        <Panel className="p-6">
          <div className="mb-6">
            <h2 className="text-xl font-semibold">
              Receive Lottery Shipment
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Log a shipment before scanning packs.
            </p>
          </div>

          {/* Invoice Number */}
          <div className="mb-5">
            <label className="mb-2 flex items-center gap-2 text-sm font-medium">
              <FileText size={16} />
              Invoice Number
            </label>

            <input
              className="w-full rounded-lg border px-4 py-3"
              value={shipment.invoiceNumber ?? ""}
              onChange={(e) =>
                setShipment((prev) => ({
                  ...prev,
                  invoiceNumber: e.target.value,
                }))
              }
            />
          </div>

          {/* Invoice Upload */}
          <div className="mb-5">
            <label className="mb-2 flex items-center gap-2 text-sm font-medium">
              <Camera size={16} />
              Invoice Photo
            </label>

            <InvoiceUpload
              value={shipment.invoicePhoto ?? ""}
              onChange={(url) =>
                setShipment((prev) => ({
                  ...prev,
                  invoicePhoto: url,
                }))
              }
            />
          </div>

          {/* Bottom Grid */}
          <div className="grid grid-cols-3 gap-5">
            {/* Received By */}
            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-medium">
                <User size={16} />
                Received By
              </label>

              <input
                className="w-full rounded-lg border px-4 py-3"
                value={shipment.receivedBy ?? ""}
                onChange={(e) =>
                  setShipment((prev) => ({
                    ...prev,
                    receivedBy: e.target.value,
                  }))
                }
              />
            </div>

            {/* Shipment Date */}
            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-medium">
                <Calendar size={16} />
                Shipment Date
              </label>

              <input
                type="date"
                className="w-full rounded-lg border px-4 py-3"
                value={shipment.shipmentDate ?? ""}
                onChange={(e) =>
                  setShipment((prev) => ({
                    ...prev,
                    shipmentDate: e.target.value,
                  }))
                }
              />
            </div>

            {/* Expected Packs */}
            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-medium">
                <Package size={16} />
                Expected Packs
              </label>

              <input
                type="number"
                className="w-full rounded-lg border px-4 py-3"
                value={shipment.expectedPacks ?? 0}
                onChange={(e) =>
                  setShipment((prev) => ({
                    ...prev,
                    expectedPacks: Number(e.target.value),
                  }))
                }
              />
            </div>
          </div>
        </Panel>
      </div>

      {/* RIGHT */}
      <div>
        <Panel className="sticky top-6 p-6">
          <h3 className="mb-4 text-lg font-semibold">
            Shipment Summary
          </h3>

          <div className="space-y-4">
            <div className="flex justify-between">
              <span className="text-gray-500">Invoice</span>
              <span className="font-semibold">
                {shipment.invoiceNumber || "-"}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-500">
                Received By
              </span>

              <span>
                {shipment.receivedBy || "-"}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-500">
                Expected Packs
              </span>

              <span>
                {shipment.expectedPacks ?? 0}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-500">
                Status
              </span>

              <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-700">
                {shipment.status || "IN_PROGRESS"}
              </span>
            </div>

            <div className="mt-6">
              <h4 className="mb-2 text-sm font-semibold">
                Preview
              </h4>

              <div className="flex h-64 items-center justify-center rounded-xl border bg-gray-50">
                {shipment.invoicePhoto ? (
                  <img
                    src={shipment.invoicePhoto}
                    alt="Invoice Preview"
                    className="h-full w-full rounded-xl object-contain"
                  />
                ) : (
                  <div className="text-center text-gray-500">
                    <Camera
                      size={42}
                      className="mx-auto mb-3 opacity-40"
                    />
                    <p>No invoice uploaded</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <Button
            className="mt-8 w-full"
            onClick={handleContinue}
          >
            Continue to Scan Packs →
          </Button>
        </Panel>
      </div>
    </div>
  );
}