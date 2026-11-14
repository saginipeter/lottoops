import type { ReportDocument } from "./report-document";
import { compareDisplayNumberLabels } from "./display-number-order";
import { formatReportTimestamp } from "./report-timestamp";

export interface MidShiftAuditSnapshot {
  generatedAt: string;
  storeName: string;
  shift: { id: string; shiftNumber: number | null; status: string; openedAt: string; openedBy: string };
  audit: { id: string; status: string; begunAt: string; begunBy: string; endedAt: string | null; endedBy: string | null };
  activeDisplayCount: number;
  activePacks: Array<{
    display: string;
    pack: string;
    game: string;
    direction: string;
    openingExpectedTicket: number | null;
    openingPhysicalTicket: number | null;
    currentExpectedTicket: number;
    closingPhysicalTicket: number | null;
    provisionalVariance: number | null;
    scanStatus: string;
  }>;
}

function formatTimestamp(value: string | null): string {
  if (!value) return "Not recorded";
  return formatReportTimestamp(value);
}
function formatReportTime(value: string | null): string {
  return value ? formatReportTimestamp(value) : "Not recorded";
}

export function buildMidShiftAuditSnapshotDocument(snapshot: MidShiftAuditSnapshot): ReportDocument {
  const activeRows = snapshot.activePacks.length
    ? [...snapshot.activePacks].sort((left, right) => compareDisplayNumberLabels(left.display, right.display)).map((line) => [
        line.display,
        line.pack,
        line.game,
        line.direction,
        line.openingExpectedTicket ?? "Not recorded",
        line.openingPhysicalTicket ?? "Not scanned",
        line.currentExpectedTicket,
        line.closingPhysicalTicket ?? "Not scanned",
        line.provisionalVariance == null ? "Not available" : `${line.provisionalVariance > 0 ? "+" : ""}${line.provisionalVariance}`,
        line.scanStatus,
      ])
    : [["—", "—", "—", "—", "—", "—", "—", "—", "—", "No active display packs in scope"]];

  return {
    title: "Mid-Shift Audit Snapshot",
    subtitle: snapshot.storeName,
    paper: "A4",
    metadata: [
      { label: "Shift", value: snapshot.shift.shiftNumber == null ? "Unnumbered" : `Shift ${snapshot.shift.shiftNumber}` },
      { label: "Shift status", value: snapshot.shift.status },
      { label: "Shift opened", value: formatTimestamp(snapshot.shift.openedAt) },
      { label: "Shift opened by", value: snapshot.shift.openedBy },
      { label: "Audit status", value: snapshot.audit.status === "COMPLETED" ? "Closing audit complete; shift remains open" : "In progress" },
      { label: "Audit begun", value: formatTimestamp(snapshot.audit.begunAt) },
      { label: "Audit begun by", value: snapshot.audit.begunBy },
      { label: "Audit ended", value: formatReportTime(snapshot.audit.endedAt) },
      { label: "Audit ended by", value: snapshot.audit.endedBy ?? "Not recorded" },
      { label: "Snapshot generated at", value: formatReportTime(snapshot.generatedAt) },
      { label: "Active displays in scope", value: snapshot.activeDisplayCount },
    ],
    sections: [{
      title: "Current Physical Audit Snapshot",
      columns: ["Display #", "Pack", "Game", "Direction", "Opening expected", "Opening physical", "Current expected", "Closing physical", "Provisional variance", "Status"],
      rows: activeRows,
    }],
    notes: [
      "This is a read-only snapshot of a shift that is still open. It does not close the shift or complete an audit.",
      "Active display membership, current expected ticket, physical scans, and variance are as of the generated timestamp above.",
      "Any closing physical scan and variance shown before shift close are provisional and may change; missing scans are not zero.",
      "Opening expected and physical readings are the values recorded at the opening audit. This snapshot is not the finalized shift ticket-tracking or Register Scratch Off Sales report.",
    ],
  };
}

export async function loadMidShiftAuditSnapshotDocument(auditId: string): Promise<ReportDocument> {
  const response = await fetch(`/api/inventory-audits/${encodeURIComponent(auditId)}/snapshot`, { cache: "no-store" });
  if (!response.ok) throw new Error("Unable to load the current audit snapshot.");
  const snapshot = await response.json() as MidShiftAuditSnapshot;
  return buildMidShiftAuditSnapshotDocument(snapshot);
}
