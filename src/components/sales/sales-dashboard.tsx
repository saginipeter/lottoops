"use client";

import { Panel } from "@/components/ui/panel";
import TicketScanner from "./ticket-scanner";

export default function SalesDashboard() {
  return (
    <div className="grid grid-cols-3 gap-6">

      <div className="col-span-2">

        <Panel className="p-6">

          <h2 className="text-xl font-semibold">
            Scan Ticket
          </h2>

          <p className="mb-6 text-sm text-gray-500">
            Scan a lottery ticket barcode to register a sale.
          </p>

          <TicketScanner />

        </Panel>

      </div>

      <Panel className="p-6">

        <h3 className="font-semibold mb-4">
          Today's Sales
        </h3>

        <div className="space-y-4">

          <Stat
            label="Tickets Sold"
            value="0"
          />

          <Stat
            label="Revenue"
            value="$0.00"
          />

          <Stat
            label="Active Packs"
            value="0"
          />

        </div>

      </Panel>

    </div>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border p-4">

      <div className="text-sm text-gray-500">
        {label}
      </div>

      <div className="mt-1 text-2xl font-bold">
        {value}
      </div>

    </div>
  );
}