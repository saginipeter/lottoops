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

import type {
  ShipmentState,
  PackWithGame,
} from "@/lib/types";

interface ConfirmStepProps {
  shipment: ShipmentState;
  packs: PackWithGame[];
  previousStep: () => void;
}

export function ConfirmStep({
  shipment,
  packs,
  previousStep,
}: ConfirmStepProps) {
  const [notes, setNotes] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    try {
      setLoading(true);

      const res = await fetch("/api/shipments/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          shipmentId: shipment.id,
          notes,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error);
        return;
      }

      setConfirmed(true);
    } catch (error) {
      console.error(error);
      alert("Unable to confirm shipment.");
    } finally {
      setLoading(false);
    }
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
            All scanned packs have been received and moved to Back Stock.
          </p>

          <div className="mt-10 grid grid-cols-3 gap-5">

            <SummaryCard
              icon={<FileText size={22} />}
              label="Invoice"
              value={shipment.invoiceNumber ?? ""}
            />

            <SummaryCard
              icon={<Package size={22} />}
              label="Packs"
              value={packs.length.toString()}
            />

            <SummaryCard
              icon={<User size={22} />}
              label="Received By"
              value={shipment.receivedBy ?? ""}
            />

          </div>

          <Button
            className="mt-10"
            onClick={() => {
              window.location.href = "/inventory";
            }}
          >
            Return to Inventory
          </Button>

        </div>
      </Panel>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-6">

      <div className="col-span-2 space-y-6">

        <Panel className="p-6">

          <div className="flex items-center gap-3">

            <Warehouse className="text-purple-700" />

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
              value={shipment.invoiceNumber ?? ""}
            />

            <Info
              label="Expected Packs"
              value={(shipment.expectedPacks ?? 0).toString()}
            />

            <Info
              label="Scanned Packs"
              value={packs.length.toString()}
            />

            <Info
              label="Status"
              value={shipment.status ?? ""}
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
            className="w-full rounded-lg border border-gray-300 p-4 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
          />

        </Panel>

      </div>

      <Panel className="sticky top-6 p-6">

        <h3 className="text-lg font-semibold">
          Final Summary
        </h3>

        <div className="mt-6 space-y-4">

          <Summary
            label="Invoice"
            value={shipment.invoiceNumber ?? ""}
          />

          <Summary
            label="Expected"
            value={(shipment.expectedPacks ?? 0).toString()}
          />

          <Summary
            label="Scanned"
            value={packs.length.toString()}
          />

        </div>

        <div className="mt-8 rounded-xl bg-green-50 p-5">

          <div className="flex items-center gap-2">

            <CheckCircle2 className="text-green-600" />

            <span className="font-semibold text-green-700">
              Ready to Move to Back Stock
            </span>

          </div>

        </div>

        <div className="mt-8 space-y-3">

          <Button
            variant="secondary"
            className="w-full"
            onClick={previousStep}
          >
            ← Back
          </Button>

          <Button
            className="w-full"
            disabled={loading}
            onClick={handleConfirm}
          >
            {loading ? "Confirming..." : "Confirm Receipt"}
          </Button>

        </div>

      </Panel>

    </div>
  );
}

function Summary({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex justify-between border-b pb-3">
      <span className="text-gray-500">{label}</span>
      <span className="font-semibold">{value}</span>
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
      <div className="text-xs uppercase text-gray-500">{label}</div>
      <div className="mt-2 font-semibold">{value}</div>
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