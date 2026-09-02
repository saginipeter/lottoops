"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, FileText, Camera } from "lucide-react";

import type {
  ShipmentState,
  PackWithGame,
} from "@/lib/types";

import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";

import { ShipmentSummary } from "../shipment-summary";
import { ScannedPackTable } from "../scanned-pack-table";

interface ReviewStepProps {
  shipment: ShipmentState;
  packs: PackWithGame[];
  updatePack: (pack: PackWithGame) => void;
  onOverrideApproved: () => void;
  overrideApproved?: boolean;

  nextStep: () => void;
  previousStep: () => void;
  onCancel: () => void;
}

export function ReviewStep({
  shipment,
  packs,
  updatePack,
  onOverrideApproved,
  overrideApproved = false,
  nextStep,
  previousStep,
  onCancel,
}: ReviewStepProps) {
  const [overrideLoading, setOverrideLoading] = useState(false);
  const [overrideError, setOverrideError] = useState("");
  const expected = shipment.expectedPacks ?? 0;
  const expectedRetailValue = Number(shipment.expectedRetailValue ?? 0);
  const scanned = packs.length;
  const remaining = expected - scanned;
  const scannedRetailValue = packs.reduce(
    (sum, pack) =>
      sum + Number(pack.ticketPrice ?? 0) * Number(pack.ticketQuantity ?? 0),
    0
  );

  async function requestOverride() {
    if (!shipment.id) return;
    const reason = window.prompt("Enter the reason for this shipment override:");
    if (reason === null || !reason.trim()) return;

    try {
      setOverrideLoading(true);
      setOverrideError("");
      const response = await fetch("/api/shipments/override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shipmentId: shipment.id, reason: reason.trim() }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setOverrideError(data?.error || "Unable to approve shipment override.");
        return;
      }
      onOverrideApproved();
    } catch {
      setOverrideError("Unable to approve shipment override.");
    } finally {
      setOverrideLoading(false);
    }
  }

  const duplicatePacks = packs.filter(
    (pack, index) =>
      packs.findIndex(
        (p) =>
          p.packNumber === pack.packNumber &&
          p.gameNumber === pack.gameNumber
      ) !== index
  );

  return (
    <div className="grid grid-cols-3 gap-6">

      <div className="col-span-2 space-y-6">

        {/* Step 1-4: Shipment Details */}
        <Panel className="p-6">

          <div className="mb-5 flex items-center gap-3">

            <FileText className="text-purple-700" />

            <div>

              <h2 className="text-xl font-semibold">
                Step 3: Review Shipment
              </h2>

              <p className="text-sm text-gray-500">
                Verify all shipment information before confirming.
              </p>

            </div>

          </div>

          <div className="space-y-4">
            
            {/* Step 1-2: Invoice Info */}
            <div className="rounded-lg bg-blue-50 p-4 border border-blue-200">
              <h4 className="text-sm font-semibold text-blue-900 mb-3">Invoice Information</h4>
              <div className="grid grid-cols-2 gap-3">
                <Info label="Invoice #" value={shipment.invoiceNumber ?? ""} />
                <Info label="Status" value={shipment.status ?? ""} />
              </div>
              {shipment.invoicePhoto && (
                <div className="mt-3 flex h-24 items-center rounded border bg-white p-2">
                  <img src={shipment.invoicePhoto} alt="Invoice" className="h-full object-contain" />
                </div>
              )}
            </div>

            {/* Step 3-4: Confirmation Info */}
            <div className="rounded-lg bg-green-50 p-4 border border-green-200">
              <h4 className="text-sm font-semibold text-green-900 mb-3">Shipment Confirmation</h4>
              <div className="grid grid-cols-2 gap-3">
                <Info label="Confirmation #" value={shipment.shipmentConfirmationNumber ?? ""} />
              </div>
              {shipment.confirmationReceiptPhoto && (
                <div className="mt-3 flex h-24 items-center rounded border bg-white p-2">
                  <img src={shipment.confirmationReceiptPhoto} alt="Confirmation" className="h-full object-contain" />
                </div>
              )}
            </div>

            {/* Summary */}
            <div className="grid grid-cols-3 gap-3">
              <Info label="Expected Packs" value={expected.toString()} />
              <Info label="Scanned Packs" value={scanned.toString()} />
              <Info label="Remaining" value={remaining.toString()} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Info
                label="Expected Invoice Value"
                value={`$${expectedRetailValue.toFixed(2)}`}
              />
              <Info
                label="Scanned Invoice Value"
                value={`$${scannedRetailValue.toFixed(2)}`}
              />
            </div>

          </div>

        </Panel>

        {/* Validation Results */}
        <Panel className="p-6">

          <h3 className="mb-5 text-lg font-semibold">
            Validation Results
          </h3>

          <ValidationItem
            success={remaining === 0}
            title="Shipment Count"
            description={
              remaining === 0
                ? "All expected packs have been scanned."
                : `${remaining} pack(s) still missing.`
            }
          />

          {(remaining !== 0 || expectedRetailValue <= 0 || Math.round(expectedRetailValue * 100) !== Math.round(scannedRetailValue * 100)) && (
            <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-900">Manager or Owner action required</p>
              <p className="mt-1 text-sm text-amber-800">A manager may approve this shipment discrepancy after reviewing the invoice and scanned packs.</p>
              <Button type="button" className="mt-3" variant="outline" onClick={requestOverride} disabled={overrideLoading}>
                {overrideLoading ? "Approving..." : "Approve Shipment Override"}
              </Button>
              {overrideError && <p className="mt-2 text-sm text-red-700">{overrideError}</p>}
            </div>
          )}

          <ValidationItem
            success={duplicatePacks.length === 0}
            title="Duplicate Packs"
            description={
              duplicatePacks.length === 0
                ? "No duplicate packs detected."
                : `${duplicatePacks.length} duplicate pack(s) found.`
            }
          />

          <ValidationItem
            success={
              expectedRetailValue > 0 &&
              Math.round(expectedRetailValue * 100) ===
                Math.round(scannedRetailValue * 100)
            }
            title="Invoice Value Match"
            description={
              expectedRetailValue > 0 &&
              Math.round(expectedRetailValue * 100) ===
                Math.round(scannedRetailValue * 100)
                ? "Total value matches the invoice."
                : `Invoice value: $${expectedRetailValue.toFixed(2)}. Scanned value: $${scannedRetailValue.toFixed(2)}.`
            }
          />

        </Panel>

        {/* Pack Details */}
        <Panel className="p-6">
          <h3 className="mb-4 text-lg font-semibold">
            Scanned Packs
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            Review all pack details: barcode, game, price, quantity, and image.
          </p>
        </Panel>

        <ScannedPackTable
          packs={packs}
          editable
          onUpdatePack={updatePack}
        />

      </div>

      <ShipmentSummary
        shipment={shipment}
        packs={packs}
      >

        <div className="space-y-3">

          <Button
            variant="secondary"
            className="w-full"
            onClick={previousStep}
          >
            ← Back
          </Button>

          <Button variant="outline" className="w-full" onClick={onCancel}>
            Cancel
          </Button>

          <Button
            className="w-full"
            disabled={
              (!overrideApproved && remaining > 0) ||
              duplicatePacks.length > 0 ||
              (!overrideApproved && (expectedRetailValue <= 0 ||
              Math.round(expectedRetailValue * 100) !==
                Math.round(scannedRetailValue * 100)))
            }
            onClick={nextStep}
          >
            Next: Choose Destination →
          </Button>

        </div>

      </ShipmentSummary>

    </div>
  );
}

/* ---------- Components ---------- */

function ValidationItem({
  success,
  title,
  description,
}: {
  success: boolean;
  title: string;
  description: string;
}) {
  return (
    <div
      className={`mb-4 rounded-xl border p-4 ${
        success
          ? "border-green-200 bg-green-50"
          : "border-yellow-300 bg-yellow-50"
      }`}
    >
      <div className="flex items-start gap-3">

        {success ? (
          <CheckCircle2
            className="mt-1 text-green-600"
            size={20}
          />
        ) : (
          <AlertTriangle
            className="mt-1 text-yellow-600"
            size={20}
          />
        )}

        <div>

          <div className="font-semibold">
            {title}
          </div>

          <div className="text-sm text-gray-600">
            {description}
          </div>

        </div>

      </div>

    </div>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border bg-gray-50 p-4">

      <div className="text-xs uppercase tracking-wide text-gray-500">
        {label}
      </div>

      <div className="mt-2 font-semibold">
        {value}
      </div>

    </div>
  );
}