"use client";

import { ReactNode } from "react";
import {
  FileText,
  User,
  Package,
  CheckCircle2,
} from "lucide-react";

import { Panel } from "@/components/ui/panel";
import type { PackWithGame } from "@/lib/types";

interface ShipmentSummaryProps {
  shipment: {
    invoiceNumber: string;
    receivedBy: string;
    expectedPacks: number;
    scannedPacks: number;
    status: string;
  };

  packs: PackWithGame[];

  children?: ReactNode;
}

export function ShipmentSummary({
  shipment,
  packs,
  children,
}: ShipmentSummaryProps) {
  const scanned = packs.length;
  const expected = shipment.expectedPacks;
  const remaining = Math.max(expected - scanned, 0);

  const progress =
    expected === 0
      ? 0
      : Math.round((scanned / expected) * 100);

  return (
    <Panel className="sticky top-6 p-6">
      <h2 className="mb-6 text-xl font-semibold">
        Shipment Summary
      </h2>

      <div className="space-y-5">
        <SummaryRow
          icon={<FileText size={18} />}
          label="Invoice"
          value={shipment.invoiceNumber}
        />

        <SummaryRow
          icon={<User size={18} />}
          label="Received By"
          value={shipment.receivedBy}
        />

        <SummaryRow
          icon={<Package size={18} />}
          label="Expected Packs"
          value={String(expected)}
        />
      </div>

      <div className="mt-8">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium">
            Progress
          </span>

          <span className="font-semibold text-purple-700">
            {scanned} / {expected}
          </span>
        </div>

        <div className="h-3 overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full rounded-full bg-purple-600 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="mt-8 space-y-4">
        <div className="rounded-xl bg-green-50 p-4">
          <div className="text-sm text-gray-500">
            Packs Logged
          </div>

          <div className="mt-1 text-3xl font-bold text-green-700">
            {scanned}
          </div>
        </div>

        <div className="rounded-xl bg-yellow-50 p-4">
          <div className="text-sm text-gray-500">
            Remaining
          </div>

          <div className="mt-1 text-3xl font-bold text-yellow-700">
            {remaining}
          </div>
        </div>
      </div>

      <div className="mt-8 rounded-xl border border-purple-200 bg-purple-50 p-4">
        <div className="flex items-center gap-2">
          <CheckCircle2
            size={18}
            className="text-purple-700"
          />

          <span className="font-semibold text-purple-700">
            {shipment.status}
          </span>
        </div>
      </div>

      {children && (
        <div className="mt-8 border-t pt-6">
          {children}
        </div>
      )}
    </Panel>
  );
}

interface SummaryRowProps {
  icon: ReactNode;
  label: string;
  value: string;
}

function SummaryRow({
  icon,
  label,
  value,
}: SummaryRowProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-100 text-purple-700">
          {icon}
        </div>

        <span className="text-sm text-gray-600">
          {label}
        </span>
      </div>

      <span className="font-semibold">
        {value}
      </span>
    </div>
  );
}