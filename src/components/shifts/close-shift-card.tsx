"use client";

import { useState } from "react";

import {
  CheckCircle2,
  Clock,
} from "lucide-react";

import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { ReportActions } from "@/components/reports/report-actions";
import { loadShiftReportDocument } from "@/lib/shift-report";

import ShiftPackTable from "./shift-pack-table";

interface Props {
  shift: any;
}

export default function CloseShiftCard({
  shift,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [closed, setClosed] = useState(false);
  const [countedCash, setCountedCash] = useState("");

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
          countedCash: Number(countedCash),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error);
        return;
      }

      setClosed(true);
    } catch (err) {
      console.error(err);
      alert("Unable to close shift.");
    } finally {
      setLoading(false);
    }
  }

  if (closed) {
    return (
      <Panel className="space-y-4 p-6">
        <h2 className="text-2xl font-bold">Shift closed</h2>
        <p className="text-sm text-text-secondary">View or print the finalized sales and audit report.</p>
        <ReportActions key={shift.id} loadDocument={() => loadShiftReportDocument(shift.id)} />
        <Button variant="outline" onClick={() => window.location.reload()}>Continue</Button>
      </Panel>
    );
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
        <label className="mb-4 block text-sm font-medium">
          Counted closing drawer cash
          <input type="number" min="0" step="0.01" value={countedCash}
            onChange={(event) => setCountedCash(event.target.value)}
            className="mt-2 block w-full rounded-md border border-border px-3 py-2" />
        </label>
        <Button
          className="w-full"
          disabled={loading || countedCash === "" || !Number.isFinite(Number(countedCash)) || Number(countedCash) < 0}
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