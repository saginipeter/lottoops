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
  if (!shipment.invoiceNumber?.trim()) {
    alert("Please enter an invoice number.");
    return;
  }

  if (!shipment.invoicePhoto) {
    alert("Please upload an invoice photo.");
    return;
  }

  if (!shipment.shipmentConfirmationNumber?.trim()) {
    alert("Please enter a shipment confirmation number.");
    return;
  }

  if (!shipment.confirmationReceiptPhoto) {
    alert("Please upload a confirmation receipt photo.");
    return;
  }

  if (!shipment.expectedPacks || shipment.expectedPacks <= 0) {
    alert("Expected packs must be greater than zero.");
    return;
  }

  if (!shipment.expectedRetailValue || shipment.expectedRetailValue <= 0) {
    alert("Expected invoice total value must be greater than zero.");
    return;
  }

  try {
    const response = await fetch("/api/shipments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        invoiceNumber: shipment.invoiceNumber,
        invoicePhoto: shipment.invoicePhoto,
        shipmentConfirmationNumber: shipment.shipmentConfirmationNumber,
        confirmationReceiptPhoto: shipment.confirmationReceiptPhoto,
        shipmentDate: shipment.shipmentDate,
        expectedPacks: shipment.expectedPacks,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.error || "Unable to create shipment.");
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
              Step 1-4: Receive Lottery Shipment
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Enter shipment details and upload required documents.
            </p>
          </div>

          {/* STEP 1: Invoice Number */}
          <div className="mb-5">
            <label className="mb-2 flex items-center gap-2 text-sm font-medium">
              <FileText size={16} />
              Step 1: Invoice Number
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
              placeholder="Enter invoice number"
            />
          </div>

          {/* STEP 2: Invoice Upload */}
          <div className="mb-5">
            <label className="mb-2 flex items-center gap-2 text-sm font-medium">
              <Camera size={16} />
              Step 2: Invoice Photo
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

          {/* STEP 3: Shipment Confirmation Number */}
          <div className="mb-5">
            <label className="mb-2 flex items-center gap-2 text-sm font-medium">
              <FileText size={16} />
              Step 3: Shipment Confirmation Number
            </label>

            <input
              className="w-full rounded-lg border px-4 py-3"
              value={shipment.shipmentConfirmationNumber ?? ""}
              onChange={(e) =>
                setShipment((prev) => ({
                  ...prev,
                  shipmentConfirmationNumber: e.target.value,
                }))
              }
              placeholder="Enter confirmation number"
            />
            <p className="mt-1 text-xs text-gray-500">
              This is different from the invoice number
            </p>
          </div>

          {/* STEP 4: Confirmation Receipt Photo */}
          <div className="mb-5">
            <label className="mb-2 flex items-center gap-2 text-sm font-medium">
              <Camera size={16} />
              Step 4: Confirmation Receipt Photo
            </label>

            <InvoiceUpload
              value={shipment.confirmationReceiptPhoto ?? ""}
           

              onChange={(url) =>
                setShipment((prev) => ({
                  ...prev,
                  confirmationReceiptPhoto: url,
                }))
              }
            />
          </div>

          {/* Bottom Grid */}
          <div className="grid grid-cols-2 gap-5">
          

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

          <div className="mt-5">
            <label className="mb-2 flex items-center gap-2 text-sm font-medium">
              <Package size={16} />
              Expected Invoice Total Value ($)
            </label>

            <input
              type="number"
              min="0"
              step="0.01"
              className="w-full rounded-lg border px-4 py-3"
              value={shipment.expectedRetailValue ?? 0}
              onChange={(e) =>
              setShipment((prev) => ({
                ...prev,
                expectedRetailValue: Number(e.target.value),
              }))
              }
            />
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
              <span className="text-gray-500">Confirmation #</span>
              <span className="font-semibold">
                {shipment.shipmentConfirmationNumber || "-"}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-500">
                Received By
              </span>

              <span className="text-green-600 font-medium">
                Current User
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
              <span className="text-gray-500">Invoice Total Value</span>
              <span>${Number(shipment.expectedRetailValue ?? 0).toFixed(2)}</span>
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
                Confirmation Receipt Preview
              </h4>

              <div className="flex h-40 items-center justify-center rounded-xl border bg-gray-50">
                {shipment.confirmationReceiptPhoto ? (
                  <img
                    src={shipment.confirmationReceiptPhoto}
                    alt="Confirmation Receipt"
                    className="h-full w-full rounded-xl object-contain"
                  />
                ) : (
                  <div className="text-center text-gray-500">
                    <Camera
                      size={32}
                      className="mx-auto mb-2 opacity-40"
                    />
                    <p className="text-xs">No receipt uploaded</p>
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