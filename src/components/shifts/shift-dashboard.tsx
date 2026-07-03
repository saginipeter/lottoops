"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { formatCurrency } from "@/lib/utils";
import { Clock, PlayCircle, Square } from "lucide-react";

import ShiftPackTable from "./shift-pack-table";

interface ShiftDashboardProps {
  shift: any | null;
}

export default function ShiftDashboard({ shift }: ShiftDashboardProps) {
  const [loading, setLoading] = useState(false);

  async function openShift() {
    try {
      setLoading(true);

      const res = await fetch("/api/shifts/open", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error);
        return;
      }

      window.location.reload();
    } finally {
      setLoading(false);
    }
  }

  async function closeShift() {
    try {
      setLoading(true);

      const res = await fetch("/api/shifts/close", {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error);
        return;
      }

      window.location.reload();
    } finally {
      setLoading(false);
    }
  }

  // NO SHIFT STATE
  if (!shift) {
    return (
      <Panel className="p-8 text-center">
        <Clock className="mx-auto mb-4 text-gray-400" size={40} />

        <h2 className="text-xl font-semibold">
          No Active Shift
        </h2>

        <p className="mt-2 text-sm text-gray-500">
          Start today's shift to begin operations.
        </p>

        <Button
          className="mt-6"
          onClick={openShift}
          disabled={loading}
        >
          <PlayCircle size={16} />
          Open Shift
        </Button>
      </Panel>
    );
  }

  // OPEN SHIFT STATE
  const totalLines = shift.lines?.length || 0;

            const totalTickets = shift.lines?.reduce(
            (sum: number, line: any) => {
                const beginning = line.beginningTicket ?? 0;
                const ending = line.endingTicket ?? 0;

                const sold = beginning - ending;

                return sum + Math.max(sold, 0);
            },
            0
            );

            const totalSales = shift.lines?.reduce(
            (sum: number, line: any) => {
                const beginning = line.beginningTicket ?? 0;
                const ending = line.endingTicket ?? 0;

                const sold = beginning - ending;

                const price = Number(line.pack?.game?.price ?? 0);

                return sum + Math.max(sold, 0) * price;
            },
            0
            );


  return (
    <div className="space-y-6">

      {/* TOP SUMMARY */}
      <Panel className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">
              Shift In Progress
            </h2>

            <p className="text-sm text-gray-500">
              Active operational shift
            </p>
          </div>

          <Button
            variant="secondary"
            onClick={closeShift}
            disabled={loading}
          >
            <Square size={16} />
            Close Shift
          </Button>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-4">
          <Stat
            label="Active Packs"
            value={totalLines}
          />
          <Stat
            label="Tickets Sold"
            value={totalTickets}
          />
          <Stat
            label="Sales"
            value={formatCurrency(totalSales)}
          />
        </div>
      </Panel>

      {/* SHIFT TABLE */}
      <ShiftPackTable shift={shift} />
    </div>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: any;
}) {
  return (
    <div className="rounded-xl border bg-gray-50 p-4">
      <div className="text-xs text-gray-500">
        {label}
      </div>
      <div className="mt-1 text-xl font-bold">
        {value}
      </div>
    </div>
  );
}