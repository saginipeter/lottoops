"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { formatCurrency } from "@/lib/utils";
import { Clock, PlayCircle, Radio, Tv } from "lucide-react";

import ShiftPackTable from "./shift-pack-table";

interface ShiftDashboardProps {
  shift: any | null;
  terminalId: string;
  shiftEvents: Array<{
    id: string;
    action: string;
    detail: string;
    timestamp: string;
    performedBy: string;
  }>;
}

export default function ShiftDashboard({
  shift,
  terminalId,
  shiftEvents,
}: ShiftDashboardProps) {
  const [loading, setLoading] = useState(false);

  async function openShift() {
    try {
      setLoading(true);

      const res = await fetch("/api/shifts/open", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ terminalId }),
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

  if (!shift) {
    return (
      <div className="space-y-6">
        <Panel className="p-8">
          <div className="mx-auto max-w-2xl text-center">
            <Clock className="mx-auto mb-4 text-gray-400" size={40} />
            <h2 className="text-2xl font-semibold">No Active Shift</h2>
            <p className="mt-2 text-sm text-gray-500">
              Open shift on terminal {terminalId} to start ticket scanning and sales reconciliation.
            </p>
            <Button
              className="mt-6"
              onClick={openShift}
              disabled={loading}
            >
              <PlayCircle size={16} />
              {loading ? "Opening Shift..." : "Open Shift"}
            </Button>
          </div>
        </Panel>

        <Panel className="p-6">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {["T1", "T2", "T3", "T4"].map((t) => (
              <Link
                key={t}
                href={`/shifts?terminal=${t}`}
                className={`rounded-md border px-2.5 py-1 text-xs font-medium ${
                  terminalId === t
                    ? "border-accent bg-accent text-white"
                    : "border-border bg-surface text-text hover:bg-surface-soft"
                }`}
              >
                {t}
              </Link>
            ))}
          </div>
          <h3 className="text-base font-semibold text-text">What happens after opening?</h3>
          <div className="mt-3 grid grid-cols-1 gap-3 text-sm text-text-secondary md:grid-cols-3">
            <div className="rounded-lg border bg-surface-soft p-3">
              1) Active display packs are snapshotted.
            </div>
            <div className="rounded-lg border bg-surface-soft p-3">
              2) Live Scan records ticket movement during the shift.
            </div>
            <div className="rounded-lg border bg-surface-soft p-3">
              3) Endings are auto-calculated; close shift to finalize totals.
            </div>
          </div>
        </Panel>
      </div>
    );
  }

  const totalLines = shift.lines?.length ?? 0;

  const totalTickets =
    shift.lines?.reduce((sum: number, line: any) => {
      const beginning = line.beginningTicket ?? 0;
      const rawCurrent =
        line.pack?.currentTicketNumber === null || line.pack?.currentTicketNumber === undefined
          ? beginning
          : Number(line.pack.currentTicketNumber);
      const ending = Math.min(Math.max(rawCurrent, 0), beginning);

      return sum + Math.max(beginning - ending, 0);
    }, 0) ?? 0;

  const totalSales =
    shift.lines?.reduce((sum: number, line: any) => {
      const beginning = line.beginningTicket ?? 0;
      const rawCurrent =
        line.pack?.currentTicketNumber === null || line.pack?.currentTicketNumber === undefined
          ? beginning
          : Number(line.pack.currentTicketNumber);
      const ending = Math.min(Math.max(rawCurrent, 0), beginning);

      const sold = Math.max(beginning - ending, 0);

      return (
        sum +
        sold * Number(line.pack?.ticketPrice ?? line.pack?.game?.price ?? 0)
      );
    }, 0) ?? 0;

  return (
    <div className="space-y-6">
      <Panel className="p-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {["T1", "T2", "T3", "T4"].map((t) => (
            <Link
              key={t}
              href={`/shifts?terminal=${t}`}
              className={`rounded-md border px-2.5 py-1 text-xs font-medium ${
                terminalId === t
                  ? "border-accent bg-accent text-white"
                  : "border-border bg-surface text-text hover:bg-surface-soft"
              }`}
            >
              {t}
            </Link>
          ))}
        </div>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Shift In Progress</h2>
            <p className="text-sm text-gray-500">Ending tickets update automatically from live ticket movement.</p>
            <p className="mt-1 text-xs text-gray-500">
              Terminal {terminalId} · Opened {new Date(shift.openedAt).toLocaleString()} by {shift.openedBy?.name ?? "Unknown"}
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/inventory/live-scan?terminal=${terminalId}`}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-xs font-medium text-text transition-colors hover:bg-surface-soft"
            >
              <Radio size={14} />
              Live Scan
            </Link>
            <Link
              href="/display-slots"
              className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-xs font-medium text-text transition-colors hover:bg-surface-soft"
            >
              <Tv size={14} />
              Displays
            </Link>
          </div>
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

      <ShiftPackTable shift={shift} />

      <Panel className="p-6">
        <h3 className="text-base font-semibold text-text">Shift Timeline</h3>
        {shiftEvents.length === 0 ? (
          <p className="mt-3 text-sm text-text-secondary">No events recorded yet for this shift.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {shiftEvents.map((event) => (
              <div key={event.id} className="rounded-lg border bg-surface-soft p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">
                    {event.action.replaceAll("_", " ")}
                  </p>
                  <p className="text-xs text-text-tertiary">
                    {new Date(event.timestamp).toLocaleString()}
                  </p>
                </div>
                <p className="mt-1 text-sm text-text">{event.detail}</p>
                <p className="mt-1 text-xs text-text-tertiary">By {event.performedBy}</p>
              </div>
            ))}
          </div>
        )}
      </Panel>
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