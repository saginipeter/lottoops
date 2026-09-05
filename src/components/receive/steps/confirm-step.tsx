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
  overrideApproved?: boolean;
  onConfirmed?: () => void;
  onCancel: () => void;
}

export function ConfirmStep({
  shipment,
  packs,
  previousStep,
  overrideApproved = false,
  onConfirmed,
  onCancel,
}: ConfirmStepProps) {
  const [notes, setNotes] = useState("");
  const [destination, setDestination] = useState<"backstock" | "active">("backstock");
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const expectedRetailValue = Number(shipment.expectedRetailValue ?? 0);
  const scannedRetailValue = packs.reduce(
    (sum, pack) =>
      sum + Number(pack.ticketPrice ?? 0) * Number(pack.ticketQuantity ?? 0),
    0
  );
  const invoiceMatches =
    expectedRetailValue > 0 &&
    Math.round(expectedRetailValue * 100) === Math.round(scannedRetailValue * 100);

  async function handleConfirm() {
    if (packs.length !== Number(shipment.expectedPacks ?? 0) && !overrideApproved) {
      alert(`Expected ${shipment.expectedPacks ?? 0} packs but scanned ${packs.length}.`);
      return;
    }

    if (!invoiceMatches && !overrideApproved) {
      alert("Invoice totals do not match scanned shipment totals.");
      return;
    }

    try {
      setLoading(true);

      const res = await fetch("/api/shipments/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          shipmentId: shipment.id,
          destination,
          notes,
          expectedRetailValue,
          overrideApproved,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error);
        return;
      }

      setConfirmed(true);
      onConfirmed?.();
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
            All scanned packs have been received {destination === "active" ? "and moved to Active display" : "and moved to Back Stock"}.
          </p>

          <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-4">

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
              label="Destination"
              value={destination === "active" ? "Display" : "Back Stock"}
            />

            <SummaryCard
              icon={<Package size={22} />}
              label="Shipment Value"
              value={`$${scannedRetailValue.toFixed(2)}`}
            />

          </div>

          <Button
            className="mt-10"
            onClick={() => {
              window.location.href = destination === "active" ? "/inventory/active" : "/inventory";
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
                Step 4: Confirm & Choose Destination
              </h2>

              <p className="text-gray-500">
                Choose where these packs should go.
              </p>

            </div>

          </div>

        </Panel>

        <Panel className="p-6">

          <h3 className="mb-6 text-lg font-semibold">
            Shipment Details
          </h3>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">

            <Info
              label="Invoice"
              value={shipment.invoiceNumber ?? ""}
            />

            <Info
              label="Confirmation #"
              value={shipment.shipmentConfirmationNumber ?? ""}
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
              label="Expected Invoice Value"
              value={`$${expectedRetailValue.toFixed(2)}`}
            />

            <Info
              label="Scanned Invoice Value"
              value={`$${scannedRetailValue.toFixed(2)}`}
            />

          </div>

        </Panel>

        <Panel className="p-6">

          <h3 className="mb-6 text-lg font-semibold">
            Choose Destination
          </h3>

          <p className="mb-4 text-sm text-gray-600">
            Where should these packs be sent after receipt?
          </p>

          <div className="space-y-4">

            {/* Back Stock Option */}
            <label className={`flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-all ${
              destination === "backstock" 
                ? "border-purple-500 bg-purple-50" 
                : "border-gray-200 bg-white hover:border-purple-300"
            }`}>
              <input
                type="radio"
                name="destination"
                value="backstock"
                checked={destination === "backstock"}
                onChange={() => setDestination("backstock")}
                className="mt-1"
              />
              <div>
                <div className="font-semibold">Back Stock</div>
                <div className="text-sm text-gray-600">
                  Packs will be stored in inventory and require activation before being displayed for sale.
                </div>
              </div>
            </label>

            {/* Active/Display Option */}
            <label className={`flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-all ${
              destination === "active" 
                ? "border-purple-500 bg-purple-50" 
                : "border-gray-200 bg-white hover:border-purple-300"
            }`}>
              <input
                type="radio"
                name="destination"
                value="active"
                checked={destination === "active"}
                onChange={() => setDestination("active")}
                className="mt-1"
              />
              <div>
                <div className="font-semibold">Active Display</div>
                <div className="text-sm text-gray-600">
                  Packs will be immediately placed on display and available for sale.
                </div>
              </div>
            </label>

          </div>

        </Panel>

        <Panel className="p-6">

          <h3 className="mb-4 text-lg font-semibold">
            Manager Notes (Optional)
          </h3>

          <textarea
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes about this shipment..."
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

          <Summary
            label="Destination"
            value={destination === "active" ? "Display (Active)" : "Back Stock"}
          />

        </div>

        <div className="mt-8 rounded-xl bg-green-50 p-5">

          <div className="flex items-center gap-2">

            <CheckCircle2 className="text-green-600" />

            <span className="font-semibold text-green-700">
              {invoiceMatches ? "Ready to Confirm" : "Invoice totals must match before confirmation"}
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
            variant="outline"
            className="w-full"
            onClick={onCancel}
          >
            Cancel
          </Button>

          <Button
            className="w-full"
            disabled={loading || !invoiceMatches}
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