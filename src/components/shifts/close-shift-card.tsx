"use client";

import { useState } from "react";

import {
  CheckCircle2,
  Clock,
} from "lucide-react";

import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";

import ShiftPackTable from "./shift-pack-table";

interface Props {
  shift: any;
}

export default function CloseShiftCard({
  shift,
}: Props) {
  const [loading, setLoading] = useState(false);

  async function closeShift() {
    try {
      setLoading(true);

      const res = await fetch("/api/shifts/close", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          shiftId: shift.id,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error);
        return;
      }

      alert(
        `Shift Closed

Tickets Sold: ${data.totalTickets}

Sales: $${Number(data.totalSales).toFixed(2)}`
      );

      window.location.reload();
    } catch (err) {
      console.error(err);
      alert("Unable to close shift.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">

      <Panel className="p-6">

        <div className="flex items-center gap-4">

          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">

            <Clock
              className="text-green-700"
              size={34}
            />

          </div>

          <div>

            <h2 className="text-2xl font-bold">
              Close Shift
            </h2>

            <p className="text-gray-500">
              Enter the ending ticket number for every
              active display pack before closing today's
              shift.
            </p>

          </div>

        </div>

      </Panel>

      <ShiftPackTable shift={shift} />

      <Panel className="p-6">

        <Button
          className="w-full"
          disabled={loading}
          onClick={closeShift}
        >

          <CheckCircle2
            size={18}
            className="mr-2"
          />

          {loading
            ? "Closing Shift..."
            : "Close Shift"}

        </Button>

      </Panel>

    </div>
  );
}