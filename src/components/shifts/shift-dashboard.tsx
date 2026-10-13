"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { formatCurrency } from "@/lib/utils";
import { Clock, PlayCircle, ShoppingCart, Tv } from "lucide-react";

import ShiftPackTable from "./shift-pack-table";
import PhysicalAuditPanel from "@/components/inventory/physical-audit-panel";
import { ReportActions } from "@/components/reports/report-actions";
import { createShiftReportDocument, shiftReportTimestamp, type ShiftReportData } from "@/lib/shift-report-document";
import { getAuditPhysicalTicket } from "@/lib/ticket-quantity";
import { calculatePhysicalAuditVariance } from "@/lib/core-validation";
import type { ReportDocument } from "@/lib/report-document";

export interface DashboardLine {
  id: string;
  packId: string;
  slotNumber: string;
  beginningTicket: number;
  endingTicket: number | null;
  pack: {
    id: string; packNumber: string; serialNumber: string; currentTicketNumber: number | null; ticketPrice?: number | string | null;
    firstTicket?: number | null; ticketQuantity?: number | null; firstOrLastTicket?: "FIRST" | "LAST";
    game: { name: string; price: number; ticketsPerPack?: number };
  };
}

export interface DashboardShift {
  id: string;
  openedAt: string;
  closedAt?: string | null;
  openedBy?: { name: string };
  closedBy?: { name: string } | null;
  openingCash?: number | string | null;
  expectedCash?: number | string | null;
  countedCash?: number | string | null;
  cashVariance?: number | string | null;
  lines: DashboardLine[];
  inventoryAudit?: {
    id: string;
    status: string;
    lines: Array<{
      id: string; packId: string; slotNumber: string; pack?: { serialNumber: string; game: { name: string } };
      beginningPhysicalTicket: number | null; endingPhysicalTicket: number | null;
      endingExpectedTicket?: number | null;
    }>;
  };
}

interface ShiftDashboardProps {
  shift: DashboardShift | null;
  recentClosedShift?: Omit<DashboardShift, "id"> & { id?: string } | null;
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
  return shiftReportTimestamp(typeof value === "string" ? value : value.toISOString());
}

export function ArchivedShiftReportActions({ shiftId }: { shiftId?: string }) {
  const [report, setReport] = useState<ReportDocument | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!shiftId) return;
    const controller = new AbortController();
    async function load() {
      setReport(null);
      setError("");
      try {
        const response = await fetch(`/api/reports/shifts?shiftId=${encodeURIComponent(shiftId!)}`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok || !data.shifts?.[0]) throw new Error(data.error ?? "Closed shift not found.");
        setReport(createShiftReportDocument(data.shifts[0] as ShiftReportData));
      } catch (error) {
        if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Unable to load shift report.");
      }
    }
    void load();
    return () => controller.abort();
  }, [shiftId, attempt]);
  if (!shiftId) return <p className="text-sm text-text-secondary">Shift report ID: Not recorded.</p>;
  if (error) return <div role="alert" className="text-sm text-red-700">{error} <Button type="button" variant="outline" onClick={() => setAttempt(attempt + 1)}>Retry report</Button></div>;
  if (!report) return <p role="status" className="text-sm text-text-secondary">Loading completed shift report…</p>;
  return <ReportActions document={report} />;
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
              Ended {shiftReportTimestamp(recentClosedShift.closedAt)} by {recentClosedShift.closedBy?.name ?? "Not recorded"}
            </p>
            <div className="mt-3"><ArchivedShiftReportActions shiftId={recentClosedShift.id} /></div>
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
    shift.lines?.reduce((sum: number, line: DashboardLine) => {
      const beginning = line.beginningTicket ?? 0;
      const rawCurrent =
        line.pack?.currentTicketNumber === null || line.pack?.currentTicketNumber === undefined
          ? beginning
          : Number(line.pack.currentTicketNumber);
      const ending = Math.min(Math.max(rawCurrent, 0), beginning);

      return sum + Math.max(beginning - ending, 0);
    }, 0) ?? 0;

  const totalSales =
    shift.lines?.reduce((sum: number, line: DashboardLine) => {
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

  const reportLines = (shift.lines ?? []).map((line) => {
    const beginning = line.beginningTicket;
    const ending = Math.min(Math.max(Number(line.pack?.currentTicketNumber ?? beginning), 0), beginning);
    const sold = beginning - ending;
    return {
      pack: line.pack?.serialNumber ?? line.packId, game: line.pack?.game?.name ?? "Not recorded",
      display: line.slotNumber, beginning, ending, ticketsSold: sold,
      sales: sold * Number(line.pack?.ticketPrice ?? line.pack?.game?.price ?? 0),
    };
  });
  const cost = totalSales * 0.95;
  const optionalNumber = (value: string | number | null | undefined) => value == null ? null : Number(value);
  const report = createShiftReportDocument({
    id: shift.id, terminalId, status: "OPEN", openedAt: shift.openedAt, closedAt: null,
    openedBy: shift.openedBy?.name ?? "Not recorded", closedBy: "Not recorded",
    ticketsSold: totalTickets, grossSales: totalSales, cogs: cost, netMargin: totalSales - cost,
    lines: reportLines,
    audit: (shift.inventoryAudit?.lines ?? []).map((line) => {
      const salesLine = shift.lines?.find((item) => item.packId === line.packId);
      const pack = salesLine?.pack;
      const expected = line.endingExpectedTicket ?? (pack ? getAuditPhysicalTicket({
        currentTicketNumber: pack.currentTicketNumber ?? salesLine?.beginningTicket ?? null,
        firstTicket: pack.firstTicket ?? null, ticketQuantity: pack.ticketQuantity ?? pack.game?.ticketsPerPack ?? null,
        firstOrLastTicket: pack.firstOrLastTicket,
      }) : null);
      return {
        pack: line.pack?.serialNumber ?? line.packId, display: line.slotNumber, direction: pack?.firstOrLastTicket,
        beginning: line.beginningPhysicalTicket, expected, ending: line.endingPhysicalTicket,
        variance: expected == null || line.endingPhysicalTicket == null ? null
          : calculatePhysicalAuditVariance(expected, line.endingPhysicalTicket),
      };
    }),
    cash: {
      openingCash: optionalNumber(shift.openingCash), expectedCash: optionalNumber(shift.expectedCash),
      countedCash: optionalNumber(shift.countedCash), cashVariance: optionalNumber(shift.cashVariance),
      reconciledAt: null, reconciledBy: null,
    },
  });

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
              href="/pos"
              className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-xs font-medium text-text transition-colors hover:bg-surface-soft"
            >
              <ShoppingCart size={14} />
              Sell Tickets
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
            <ReportActions document={report} />
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

    </div>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: string | number;
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
