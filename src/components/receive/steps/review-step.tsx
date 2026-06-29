"use client";

import { AlertTriangle, CheckCircle2, FileText } from "lucide-react";

import { ShipmentPack } from "@/data/mock-shipment";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";

import { ShipmentSummary } from "../shipment-summary";
import { ScannedPackTable } from "../scanned-pack-table";

interface ReviewStepProps {
  shipment: any;
  packs: ShipmentPack[];

  nextStep: () => void;
  previousStep: () => void;
}

export function ReviewStep({
  shipment,
  packs,
  nextStep,
  previousStep,
}: ReviewStepProps) {
  const expected = shipment.expectedPacks;
  const scanned = packs.length;
  const remaining = expected - scanned;

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

      {/* LEFT */}

      <div className="col-span-2 space-y-6">

        {/* Invoice */}

        <Panel className="p-6">

          <div className="flex items-center gap-3 mb-5">

            <FileText className="text-purple-700" />

            <div>

              <h2 className="text-xl font-semibold">
                Review Shipment
              </h2>

              <p className="text-sm text-gray-500">
                Verify the scanned packs before confirming.
              </p>

            </div>

          </div>

          <div className="grid grid-cols-3 gap-5">

            <Info
              label="Invoice"
              value={shipment.invoiceNumber}
            />

            <Info
              label="Received By"
              value={shipment.receivedBy}
            />

            <Info
              label="Expected Packs"
              value={String(expected)}
            />

          </div>

        </Panel>

        {/* Validation */}

        <Panel className="p-6">

          <h3 className="mb-5 text-lg font-semibold">
            Validation Results
          </h3>

          {/* Scanned */}

          <ValidationItem
            success={remaining === 0}
            title="Shipment Count"
            description={
              remaining === 0
                ? "All expected packs have been scanned."
                : `${remaining} pack(s) still missing.`
            }
          />

          {/* Duplicate */}

          <ValidationItem
            success={duplicatePacks.length === 0}
            title="Duplicate Packs"
            description={
              duplicatePacks.length === 0
                ? "No duplicate pack numbers detected."
                : `${duplicatePacks.length} duplicate pack(s) found.`
            }
          />

        </Panel>

        {/* Table */}

        <ScannedPackTable
          packs={packs}
          removePack={() => {}}
        />

      </div>

      {/* RIGHT */}

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

          <Button
            className="w-full"
            disabled={
              remaining > 0 ||
              duplicatePacks.length > 0
            }
            onClick={nextStep}
          >
            Confirm Shipment →
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