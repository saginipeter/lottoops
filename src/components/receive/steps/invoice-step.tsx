"use client";

import { Calendar, Camera, FileText, Package, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";

interface InvoiceStepProps {
  shipment: {
    invoiceNumber: string;
    invoicePhoto: string;
    shipmentDate: string;
    receivedBy: string;
    expectedPacks: number;
    scannedPacks: number;
    status: string;
  };

  setShipment: React.Dispatch<React.SetStateAction<any>>;

  nextStep: () => void;
}

export function InvoiceStep({
  shipment,
  setShipment,
  nextStep,
}: InvoiceStepProps) {
  return (
    <div className="grid grid-cols-3 gap-6">

      {/* LEFT */}

      <div className="col-span-2 space-y-6">

        <Panel className="p-6">

          <div className="mb-6">
            <h2 className="text-xl font-semibold text-text">
              Receive Lottery Shipment
            </h2>

            <p className="mt-1 text-sm text-text-secondary">
              Log a shipment from the lottery commission before scanning packs.
            </p>
          </div>

          {/* Invoice Number */}

          <div className="mb-5">

            <label className="mb-2 flex items-center gap-2 text-sm font-medium">

              <FileText size={16} />

              Invoice Number

            </label>

            <input
              className="w-full rounded-lg border border-border bg-surface-soft px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
              value={shipment.invoiceNumber}
              onChange={(e) =>
                setShipment((prev: any) => ({
                  ...prev,
                  invoiceNumber: e.target.value,
                }))
              }
            />

          </div>

          {/* Upload */}

          <div className="mb-5">

            <label className="mb-2 flex items-center gap-2 text-sm font-medium">

              <Camera size={16} />

              Invoice Photo

            </label>

            <div className="flex h-48 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-purple-300 bg-purple-50 transition hover:bg-purple-100">

              <Camera
                size={40}
                className="mb-3 text-purple-600"
              />

              <p className="font-medium text-purple-700">
                Upload Invoice Photo
              </p>

              <p className="mt-1 text-sm text-gray-500">
                Drag & Drop or Click to Browse
              </p>

            </div>

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
                className="w-full rounded-lg border border-border bg-surface-soft px-4 py-3"
                value={shipment.receivedBy}
                onChange={(e) =>
                  setShipment((prev: any) => ({
                    ...prev,
                    receivedBy: e.target.value,
                  }))
                }
              />

            </div>

            {/* Date */}

            <div>

              <label className="mb-2 flex items-center gap-2 text-sm font-medium">

                <Calendar size={16} />

                Shipment Date

              </label>

              <input
                type="date"
                className="w-full rounded-lg border border-border bg-surface-soft px-4 py-3"
                value={shipment.shipmentDate}
                onChange={(e) =>
                  setShipment((prev: any) => ({
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
                className="w-full rounded-lg border border-border bg-surface-soft px-4 py-3"
                value={shipment.expectedPacks}
                onChange={(e) =>
                  setShipment((prev: any) => ({
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
              <span className="text-text-secondary">
                Invoice
              </span>

              <span className="font-semibold">
                {shipment.invoiceNumber}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-text-secondary">
                Received By
              </span>

              <span>
                {shipment.receivedBy}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-text-secondary">
                Expected Packs
              </span>

              <span>
                {shipment.expectedPacks}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-text-secondary">
                Status
              </span>

              <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-700">
                {shipment.status}
              </span>
            </div>

          </div>

          <Button
            className="mt-8 w-full"
            onClick={nextStep}
          >
            Continue to Scan Packs →
          </Button>

        </Panel>

      </div>

    </div>
  );
}