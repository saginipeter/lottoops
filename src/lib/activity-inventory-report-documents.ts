import type { ReportDocument } from "@/lib/report-document";

export interface ActivityRow {
  id: number;
  action: string;
  entityType: string;
  entityId?: string | null;
  detail: string;
  performedById: string;
  performedByName?: string | null;
  terminalId?: string | null;
  createdAt: string;
}

export type PackStatus = "ALL" | "BACK_STOCK" | "ACTIVE" | "RETURNED" | "SOLD_OUT" | "COMPLETED";

export interface InventoryReportRow {
  id: string;
  serialNumber: string;
  gameNumber?: string | null;
  packNumber?: string | null;
  status: PackStatus;
  ticketPrice?: string | number | null;
  ticketQuantity?: number | null;
  retailValue: string | number;
  removalReason?: string | null;
  activeRemovalReason?: string | null;
  game: { name: string };
  slot?: { slotNumber: string } | null;
}

const ACTION_LABELS: Record<string, string> = {
  LIVE_TICKET_SCAN: "Ticket scanned", SEQUENCE_LOCK_SELF_RESOLVED: "Employee corrected sequence", SEQUENCE_LOCK_RESOLVED: "Sequence issue resolved",
  SHIFT_OPEN: "Shift opened", SHIFT_CLOSE: "Shift closed", UPDATE_TICKET_NUMBER: "Ticket position corrected", RECEIVED: "Pack received", ACTIVATED: "Pack activated", SOLD_OUT: "Pack sold out",
};
const CORRECTION_ACTIONS = new Set(["SEQUENCE_LOCK_SELF_RESOLVED", "SEQUENCE_LOCK_RESOLVED", "UPDATE_TICKET_NUMBER"]);
const EXCEPTION_ACTIONS = new Set(["SEQUENCE_LOCK_SELF_RESOLVED", "SEQUENCE_LOCK_RESOLVED"]);

export function readableActivityAction(action: string) {
  return ACTION_LABELS[action] ?? action.replaceAll("_", " ").toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase());
}

export function activityRowStatus(action: string) {
  if (EXCEPTION_ACTIONS.has(action)) return { label: "Needs review", className: "bg-warning-soft text-warning-soft-text" };
  if (CORRECTION_ACTIONS.has(action)) return { label: "Correction", className: "bg-accent-soft text-accent-soft-text" };
  return { label: "Recorded", className: "bg-success-soft text-success-soft-text" };
}

export function summarizeActivity(rows: ActivityRow[]) {
  return {
    total: rows.length,
    people: new Set(rows.map((row) => row.performedByName ?? row.performedById)).size,
    terminals: new Set(rows.map((row) => row.terminalId).filter(Boolean)).size,
    corrections: rows.filter((row) => CORRECTION_ACTIONS.has(row.action)).length,
    exceptions: rows.filter((row) => EXCEPTION_ACTIONS.has(row.action)).length,
  };
}

export function createActivityReportDocument(rows: ActivityRow[], filters: { from: string; to: string; action: string }): ReportDocument {
  const summary = summarizeActivity(rows);
  return {
    title: "Activity Report",
    paper: "A4",
    metadata: [
      { label: "From", value: filters.from },
      { label: "To", value: filters.to },
      { label: "Action", value: filters.action === "ALL" ? "All activity" : readableActivityAction(filters.action) },
    ],
    sections: [
      { title: "Filtered activity summary", columns: ["Total events", "Users involved", "Terminals", "Corrections", "Exceptions"], rows: [[summary.total, summary.people, summary.terminals, summary.corrections, summary.exceptions]] },
      {
        title: "Activity details",
        columns: ["When", "What happened", "Completed by", "Terminal", "Status", "Details", "Event / entity"],
        rows: rows.map((row) => [
          new Date(row.createdAt).toLocaleString(), readableActivityAction(row.action),
          row.performedByName ?? row.performedById, row.terminalId ?? "—", activityRowStatus(row.action).label,
          row.detail, `${row.id} · ${row.action} · ${row.entityType} · ${row.entityId ?? "—"}`,
        ]),
        totals: ["Total events", rows.length, "", "", "", "", ""],
      },
    ],
    notes: ["Includes the loaded events matching the selected dates and action filter."],
  };
}

export function createInventoryStatusReportDocument(rows: InventoryReportRow[], counts: Record<string, number>, filters: { status: PackStatus; q: string }): ReportDocument {
  const totalRetail = rows.reduce((sum, row) => sum + Number(row.retailValue ?? 0), 0);
  const totalQuantity = rows.reduce((sum, row) => sum + (row.ticketQuantity ?? 0), 0);
  return {
    title: "Inventory Status Report",
    paper: "A4",
    metadata: [
      { label: "Status", value: filters.status.replaceAll("_", " ") },
      { label: "Search", value: filters.q.trim() || "All packs" },
      { label: "Filtered packs", value: rows.length },
      { label: "Filtered retail value", value: `$${totalRetail.toFixed(2)}` },
    ],
    sections: [
      { title: "Filtered status counts", columns: ["Status", "Packs"], rows: Object.entries(counts).map(([status, count]) => [status.replaceAll("_", " "), count]), totals: ["Total packs", rows.length] },
      {
        title: "Pack details",
        columns: ["Status", "Game", "Display #", "Pack #", "Serial", "Qty", "Retail value", "Reason"],
        rows: rows.map((row) => [
          row.status.replaceAll("_", " "), `${row.game.name} #${row.gameNumber ?? "—"}`,
          row.slot?.slotNumber ?? "—", row.packNumber ?? "—", row.serialNumber,
          row.ticketQuantity ?? 0, `$${Number(row.retailValue).toFixed(2)}`,
          row.activeRemovalReason ?? row.removalReason ?? "—",
        ]),
        totals: ["Total", "", "", "", "", totalQuantity, `$${totalRetail.toFixed(2)}`, ""],
      },
    ],
    notes: ["Includes the loaded packs matching the selected status and search (up to 1,000 packs)."],
  };
}
