"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Package,
  FileText,
  User,
  Warehouse,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";

import { ShipmentPack } from "@/data/mock-shipment";

interface ConfirmStepProps {
  shipment: {
    invoiceNumber: string;
    receivedBy: string;
    expectedPacks: number;
  };

  packs: ShipmentPack[];

  previousStep: () => void;
}

export function ConfirmStep({
  shipment,
  packs,
  previousStep,
}: ConfirmStepProps) {
  const [notes, setNotes] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  function handleConfirm() {
    // TODO:
    // POST /receive-packs/confirm

    setConfirmed(true);
  }

  if (confirmed) {
    return (
      <Panel className="mx-auto max-w-3xl p-12">

        <div className="text-center">

          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-green-100">

            <CheckCircle2
              size={48}
              className="text-green-600"
            />

          </div>

          <h2 className="mt-6 text-3xl font-bold">

            Shipment Confirmed

          </h2>

          <p className="mt-3 text-gray-500">

            All scanned packs have been received and moved to
            Back Stock.

          </p>

          <div className="mt-10 grid grid-cols-3 gap-5">

            <SummaryCard
              icon={<FileText size={22} />}
              label="Invoice"
              value={shipment.invoiceNumber}
            />

            <SummaryCard
              icon={<Package size={22} />}
              label="Packs"
              value={String(packs.length)}
            />

            <SummaryCard
              icon={<User size={22} />}
              label="Received By"
              value={shipment.receivedBy}
            />

          </div>

          <Button
            className="mt-10"
            onClick={() => window.location.reload()}
          >
            Receive Another Shipment
          </Button>

        </div>

      </Panel>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-6">

      {/* LEFT */}

      <div className="col-span-2 space-y-6">

        <Panel className="p-6">

          <div className="flex items-center gap-3">

            <Warehouse
              className="text-purple-700"
            />

            <div>

              <h2 className="text-xl font-semibold">

                Confirm Shipment

              </h2>

              <p className="text-gray-500">

                The shipment is ready to move into Back Stock.

              </p>

            </div>

          </div>

        </Panel>

        <Panel className="p-6">

          <h3 className="mb-6 text-lg font-semibold">

            Shipment Details

          </h3>

          <div className="grid grid-cols-2 gap-5">

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
              value={String(shipment.expectedPacks)}
            />

            <Info
              label="Scanned Packs"
              value={String(packs.length)}
            />

          </div>

        </Panel>

        <Panel className="p-6">

          <h3 className="mb-4 text-lg font-semibold">

            Manager Notes

          </h3>

          <textarea
            rows={6}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes..."
            className="w-full rounded-lg border border-gray-300 p-4 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none"
          />

        </Panel>

      </div>

      {/* RIGHT */}

      <Panel className="sticky top-6 p-6">

        <h3 className="text-lg font-semibold">

          Final Summary

        </h3>

        <div className="mt-6 space-y-4">

          <Summary
            label="Invoice"
            value={shipment.invoiceNumber}
          />

          <Summary
            label="Expected"
            value={String(shipment.expectedPacks)}
          />

          <Summary
            label="Scanned"
            value={String(packs.length)}
          />

        </div>

        <div className="mt-8 rounded-xl bg-green-50 p-5">

          <div className="flex items-center gap-2">

            <CheckCircle2
              className="text-green-600"
            />

            <span className="font-semibold text-green-700">

              Ready to Move to Back Stock

            </span>

          </div>

        </div>

        <div className="mt-8 space-y-3">

          <Button
            variant="outline"
            className="w-full"
            onClick={previousStep}
          >
            ← Back
          </Button>

          <Button
            className="w-full"
            onClick={handleConfirm}
          >
            Confirm Receipt
          </Button>

        </div>

      </Panel>

    </div>
  );
}

/* ---------- Small Components ---------- */

function Summary({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex justify-between border-b pb-3">

      <span className="text-gray-500">
        {label}
      </span>

      <span className="font-semibold">
        {value}
      </span>

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

      <div className="text-xs uppercase text-gray-500">
        {label}
      </div>

      <div className="mt-2 font-semibold">
        {value}
      </div>

    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border bg-gray-50 p-6">

      <div className="mb-3 text-purple-700">

        {icon}

      </div>

      <div className="text-sm text-gray-500">

        {label}

      </div>

      <div className="mt-2 text-lg font-bold">

        {value}

      </div>

    </div>
  );
}