"use client";

import { useState } from "react";
import { Calendar, Clock, PlayCircle } from "lucide-react";

import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";

export default function OpenShiftCard() {
  const [loading, setLoading] = useState(false);

  async function openShift() {
    try {
      setLoading(true);

      const res = await fetch("/api/shifts/open", {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error);
        return;
      }

      window.location.reload();
    } catch (err) {
      console.error(err);
      alert("Unable to open shift.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">

      <Panel className="p-8">

        <div className="flex items-center gap-4">

          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <PlayCircle
              size={36}
              className="text-green-600"
            />
          </div>

          <div>

            <h2 className="text-2xl font-bold">
              Open Shift
            </h2>

            <p className="text-gray-500">
              Begin today's lottery sales shift.
            </p>

          </div>

        </div>

        <div className="mt-8 grid grid-cols-2 gap-6">

          <div className="rounded-xl border bg-gray-50 p-5">

            <div className="mb-2 flex items-center gap-2 text-gray-500">
              <Calendar size={18} />
              Date
            </div>

            <div className="text-xl font-semibold">
              {new Date().toLocaleDateString()}
            </div>

          </div>

          <div className="rounded-xl border bg-gray-50 p-5">

            <div className="mb-2 flex items-center gap-2 text-gray-500">
              <Clock size={18} />
              Time
            </div>

            <div className="text-xl font-semibold">
              {new Date().toLocaleTimeString()}
            </div>

          </div>

        </div>

        <div className="mt-8 rounded-xl bg-blue-50 p-5">

          <h3 className="font-semibold">
            What happens when you open a shift?
          </h3>

          <ul className="mt-3 space-y-2 text-sm text-gray-600">
            <li>• A new shift is created.</li>
            <li>• Every ACTIVE display pack is loaded into the shift.</li>
            <li>• Beginning ticket numbers are recorded.</li>
            <li>• Sales tracking begins.</li>
          </ul>

        </div>

        <Button
          className="mt-8 w-full"
          disabled={loading}
          onClick={openShift}
        >
          {loading ? "Opening Shift..." : "Open Shift"}
        </Button>

      </Panel>

    </div>
  );
}