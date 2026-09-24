"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { formatCurrency } from "@/lib/utils";
import { Clock, PlayCircle, Radio, Tv } from "lucide-react";

import ShiftPackTable from "./shift-pack-table";
import PhysicalAuditPanel from "@/components/inventory/physical-audit-panel";

interface ShiftDashboardProps {
  shift: any | null;
  recentClosedShift?: any | null;
  participants?: Array<{ userId: string; name: string; email: string; firstSeenAt: string; lastSeenAt: string }>;
  terminalId: string;
  activeDisplayPackCount: number;
  shiftEvents: Array<{
    id: string;
    action: string;
    detail: string;
    timestamp: string;
    performedBy: string;
  }>;
}

function formatTimestamp(value: string | Date) {
  return new Date(value).toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

export default function ShiftDashboard({
  shift,
  recentClosedShift,
  participants = [],
  terminalId,
  activeDisplayPackCount,
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

        {recentClosedShift && (
          <Panel className="p-5">
            <h3 className="text-base font-semibold text-text">Last completed shift</h3>
            <p className="mt-2 text-sm text-text-secondary">
              Started {formatTimestamp(recentClosedShift.openedAt)} by {recentClosedShift.openedBy?.name ?? "Unknown"}
            </p>
            <p className="mt-1 text-sm text-text-secondary">
              Ended {formatTimestamp(recentClosedShift.closedAt)} by {recentClosedShift.closedBy?.name ?? "Unknown"}
            </p>
          </Panel>
        )}

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

  function printShiftPaperwork() {
    window.print();
  }

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
              Terminal {terminalId} · Opened {formatTimestamp(shift.openedAt)} by {shift.openedBy?.name ?? "Unknown"}
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
          <div className="mt-4 flex justify-end print:hidden">
            <Button type="button" variant="outline" onClick={printShiftPaperwork}>
              Print sales & audit records
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

      <ShiftPackTable shift={shift} />

      <div id="physical-audit">
        <PhysicalAuditPanel shiftId={shift.id} audit={shift.inventoryAudit} activeDisplayPackCount={activeDisplayPackCount} />
      </div>

      <Panel className="p-6">
        <h3 className="text-base font-semibold text-text">Employees active in this shift</h3>
        <p className="mt-1 text-sm text-text-secondary">People recorded through sales, audit, or ticket activity.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {participants.length === 0 ? <span className="text-sm text-text-secondary">No handoff activity recorded yet.</span> : participants.map((participant) => <span key={participant.userId} className="rounded-full border border-border bg-surface-soft px-3 py-1.5 text-xs text-text">{participant.name}</span>)}
        </div>
      </Panel>

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
                    {formatTimestamp(event.timestamp)}
                  </p>
                </div>
                <p className="mt-1 text-sm text-text">{event.detail}</p>
                <p className="mt-1 text-xs text-text-tertiary">By {event.performedBy}</p>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <section className="shift-paperwork hidden print:block">
        <style jsx global>{`@media print { body * { visibility: hidden; } .shift-paperwork, .shift-paperwork * { visibility: visible; } .shift-paperwork { position: absolute; left: 0; top: 0; width: 100%; padding: 24px; color: #111827; } .shift-paperwork h1 { font-size: 22px; font-weight: 700; margin-bottom: 6px; } .shift-paperwork h2 { font-size: 16px; font-weight: 700; margin: 22px 0 8px; } .shift-paperwork table { width: 100%; border-collapse: collapse; font-size: 11px; } .shift-paperwork th, .shift-paperwork td { border: 1px solid #9ca3af; padding: 5px; text-align: left; } }`}</style>
        <h1>End-of-Shift Management Records</h1>
        <p>Terminal {terminalId} · Opened {formatTimestamp(shift.openedAt)}</p>
        <h2>Sales Record</h2>
        <table>
          <thead><tr><th>Pack</th><th>Game</th><th>Tickets sold</th><th>Sales</th></tr></thead>
          <tbody>{(shift.lines ?? []).map((line: any) => {
            const beginning = Number(line.beginningTicket ?? 0);
            const current = line.pack?.currentTicketNumber == null ? beginning : Number(line.pack.currentTicketNumber);
            const sold = Math.max(beginning - Math.min(Math.max(current, 0), beginning), 0);
            return <tr key={line.id}><td>{line.pack?.serialNumber ?? line.packId}</td><td>{line.pack?.game?.name ?? "—"}</td><td>{sold}</td><td>{formatCurrency(sold * Number(line.pack?.ticketPrice ?? line.pack?.game?.price ?? 0))}</td></tr>;
          })}</tbody>
          <tfoot><tr><th colSpan={2}>Totals</th><th>{totalTickets}</th><th>{formatCurrency(totalSales)}</th></tr></tfoot>
        </table>
        <h2>Physical Audit Record</h2>
        <table>
          <thead><tr><th>Pack</th><th>Beginning ticket</th><th>Ending ticket</th><th>Variance</th></tr></thead>
          <tbody>{(shift.inventoryAudit?.lines ?? []).map((line: any) => <tr key={line.id}><td>{line.pack?.serialNumber ?? line.packId}</td><td>{line.beginningPhysicalTicket ?? "—"}</td><td>{line.endingPhysicalTicket ?? "—"}</td><td>{line.variance ?? "—"}</td></tr>)}</tbody>
        </table>
      </section>
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
