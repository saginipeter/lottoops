import type { ReportDocument, ReportValue } from "./report-document";

type Metadata = NonNullable<ReportDocument["metadata"]>;

function table(
  title: string,
  columns: string[],
  rows: ReportValue[][],
  metadata: Metadata = [],
  notes?: string[],
): ReportDocument {
  return {
    title,
    paper: "A4",
    metadata: [...metadata, { label: "Loaded records", value: rows.length }],
    sections: [{ title: "Records", columns, rows }],
    notes,
  };
}

function text(value: string | null | undefined): string | null {
  return value?.trim() ? value : null;
}

function usd(value: number | null | undefined): string | null {
  return value == null ? null : new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 2,
  }).format(value);
}

function sumRecorded(values: ReadonlyArray<number>): number | null {
  return values.every((value) => Number.isFinite(value)) ? values.reduce((sum, value) => sum + value, 0) : null;
}

export function buildInventoryAgingDocument(packs: ReadonlyArray<{
  serialNumber: string; game: string; gameNumber: string; status: string;
  display: string | null; receivedAt: string; activatedAt: string | null; ageDays: number;
}>): ReportDocument {
  return table("Inventory Aging", ["Pack", "Game", "Game number", "Status", "Display", "Received", "Activated", "Age (days)"],
    [...packs].sort((a, b) => b.ageDays - a.ageDays).map((pack) => [
      pack.serialNumber, pack.game, pack.gameNumber, pack.status.replaceAll("_", " "),
      text(pack.display), pack.receivedAt, pack.activatedAt, pack.ageDays,
    ]), [{ label: "Scope", value: "Loaded active and backstock packs" }, { label: "Order", value: "Oldest first" }]);
}

export function buildDiscrepancyDocument(rows: ReadonlyArray<{
  type: string; status: string; game: string; pack: string; display: string;
  expected: number | null; observed: number | null; variance: number | null;
  timestamp: string | null; actor: string; reason: string; resolvedBy?: string | null;
}>, filter: "ALL" | "UNRESOLVED" | "RESOLVED"): ReportDocument {
  const selected = filter === "ALL" ? rows : rows.filter((row) => row.status === filter);
  return table("Discrepancy Review",
    ["Type", "Status", "Pack", "Game", "Display", "Expected", "Observed", "Variance", "Time", "Actor", "Reason", "Resolved by"],
    selected.map((row) => [row.type, row.status, row.pack, row.game, text(row.display), row.expected,
      row.observed, row.variance, row.timestamp, text(row.actor), text(row.reason), text(row.resolvedBy)]),
    [{ label: "Status filter", value: filter }]);
}

export function buildCorrectionDocument(corrections: ReadonlyArray<{
  entityType: string; entityId: string; fieldName: string; oldValue: string | null;
  newValue: string; reason: string; correctedByName: string | null; createdAt: string;
}>): ReportDocument {
  return table("Correction History", ["Time", "Entity type", "Entity ID", "Field", "Original", "Corrected", "Reason", "Corrected by"],
    corrections.map((row) => [row.createdAt, row.entityType, row.entityId, row.fieldName, row.oldValue,
      row.newValue, text(row.reason), text(row.correctedByName)]));
}

export function buildLifecycleAnalyticsDocument(data: {
  summary: {
    averageReceiptToActivationDays: number; averageActivationToCompletionDays: number;
    backstockExposure: number; activeExposure: number; backstockOver30Days: number;
    activeOver30Days: number; reassignedPacks: number;
  };
  games: ReadonlyArray<{ gameNumber: string; game: string; packs: number; tickets: number; value: number }>;
}): ReportDocument {
  const summary = data.summary;
  return {
    title: "Pack Lifecycle & Exposure", paper: "A4",
    metadata: [{ label: "Scope", value: "Loaded store history" }],
    sections: [
      { title: "Summary", columns: ["Metric", "Value"], rows: [
        ["Average receipt to activation (days)", summary.averageReceiptToActivationDays],
        ["Average activation to completion (days)", summary.averageActivationToCompletionDays],
        ["Backstock exposure (USD)", usd(summary.backstockExposure)],
        ["Active exposure (USD)", usd(summary.activeExposure)],
        ["Backstock over 30 days", summary.backstockOver30Days],
        ["Active over 30 days", summary.activeOver30Days],
        ["Reassigned packs", summary.reassignedPacks],
      ] },
      { title: "Game movement", columns: ["Game", "Game number", "Packs", "Tickets moved", "Value (USD)"],
        rows: data.games.map((game) => [game.game, game.gameNumber, game.packs, game.tickets, usd(game.value)]),
        totals: ["Loaded game totals", null, sumRecorded(data.games.map((game) => game.packs)),
          sumRecorded(data.games.map((game) => game.tickets)), usd(sumRecorded(data.games.map((game) => game.value)))] },
    ],
  };
}

export function buildExceptionTrendsDocument(data: {
  since?: string;
  totals: ReadonlyArray<{ date: string; auditVariances: number; sequenceLocks: number; resolved: number }>;
  summary: { auditVariances: number; openSequenceLocks: number; resolved: number };
}): ReportDocument {
  return {
    title: "Exception Trends", paper: "A4",
    metadata: [{ label: "Period", value: "Last 30 days (loaded response)" }, { label: "Since", value: text(data.since) }],
    sections: [
      { title: "Summary", columns: ["Metric", "Count"], rows: [
        ["Audit variances", data.summary.auditVariances],
        ["Open sequence locks", data.summary.openSequenceLocks],
        ["Resolved", data.summary.resolved],
      ] },
      { title: "Daily events", columns: ["Date", "Audit variances", "Sequence locks", "Resolved"],
        rows: data.totals.map((day) => [day.date, day.auditVariances, day.sequenceLocks, day.resolved]) },
    ],
    notes: ["Open sequence locks are a current-state count, not a sum of daily lock events."],
  };
}

export function buildAiDiscrepancyDocument(analysis: {
  risk: string; findings: ReadonlyArray<{ type: string; detail: string }>;
  counts: { auditVariances: number; sequenceLocks: number; repeatActors: number };
}): ReportDocument {
  return {
    title: "AI Discrepancy Analysis", paper: "A4",
    metadata: [{ label: "Risk level", value: text(analysis.risk) }],
    sections: [
      { title: "Loaded analysis counts", columns: ["Metric", "Count"], rows: [
        ["Audit variances", analysis.counts.auditVariances], ["Sequence locks", analysis.counts.sequenceLocks],
        ["Repeat actors", analysis.counts.repeatActors],
      ] },
      { title: "Findings", columns: ["Type", "Detail"],
        rows: analysis.findings.map((finding) => [finding.type.replaceAll("_", " "), text(finding.detail)]) },
    ],
    notes: ["Snapshot of the current generated analysis. Viewing or printing does not run a new analysis."],
  };
}

export function buildWhatsAppSummaryDocument(summary: string, sentAt: string | null): ReportDocument {
  return {
    title: "WhatsApp Daily Summary", paper: "A4",
    metadata: [{ label: "Delivery confirmed at", value: sentAt }],
    sections: [{ title: "Sent summary", columns: ["Summary text"],
      rows: summary.split(/\r?\n/).map((line) => [text(line)]) }],
    notes: ["Existing sent summary only. Viewing or printing does not generate or send a message."],
  };
}

export function buildTicketReportsDocument(reports: ReadonlyArray<{
  id: string; storeId: string; storeName: string; detail: string;
  performedByName: string | null; createdAt: string;
}>, title = "Employee Ticket Reports"): ReportDocument {
  return table(title, ["Report ID", "Store", "Store ID", "Reported at", "Reported by", "Detail"],
    reports.map((report) => [report.id, text(report.storeName), report.storeId, report.createdAt,
      text(report.performedByName), text(report.detail)]),
    [{ label: "Scope", value: "All loaded pending reports" }],
    ["Includes every loaded record, not only the first eight cards."]);
}

export function buildTicketReturnRequestsDocument(requests: ReadonlyArray<{
  id: string; storeId: string; shiftId: string; packId: string; ticketBarcode: string | null;
  reason: string | null; requestedByName: string | null; createdAt: string;
  serialNumber: string; gameName: string; gameNumber: string; status?: string;
}>, title = "Ticket Return Requests"): ReportDocument {
  return table(title, ["Request ID", "Store ID", "Shift", "Pack ID", "Pack", "Game", "Game number", "Ticket barcode", "Reason", "Requested by", "Requested at"],
    requests.map((request) => [request.id, request.storeId, request.shiftId, request.packId,
      request.serialNumber, request.gameName, request.gameNumber, text(request.ticketBarcode),
      request.status === "RETURNED_PENDING_REVIEW"
        ? `Already returned; review only. Reason: ${request.reason ?? "Not recorded"}`
        : text(request.reason),
      text(request.requestedByName), request.createdAt]),
    [{ label: "Scope", value: "All loaded return reviews and legacy pending requests. Returned-ticket reviews do not change inventory or sales." }]);
}

export function buildShipmentOverridesDocument(notifications: ReadonlyArray<{
  id: string | number; storeName: string; detail: string; performedByName: string | null; createdAt: string;
}>): ReportDocument {
  return table("Shipment Overrides", ["Notification ID", "Store", "Time", "Approved by", "Detail"],
    notifications.map((notification) => [notification.id, text(notification.storeName), notification.createdAt,
      text(notification.performedByName), text(notification.detail)]));
}

export function buildStateReportArchiveDocument(report: {
  storeId: string; reportType: string; fileName: string; rowCount: number;
  uploadedAt: string; imageUrl?: string | null; verificationStatus?: string;
}, context: { storeName?: string; weekStart: string; label: string }): ReportDocument {
  return {
    title: `${context.label} — Archive Record`, paper: "A4",
    metadata: [
      { label: "Store", value: text(context.storeName) }, { label: "Store ID", value: report.storeId },
      { label: "Week of Monday", value: text(context.weekStart) }, { label: "Report type", value: report.reportType },
    ],
    sections: [{ title: "Saved upload metadata", columns: ["File name", "Uploaded at", "CSV rows", "Verification status", "Original evidence URL"],
      rows: [[report.fileName, report.uploadedAt, report.imageUrl ? null : report.rowCount,
        text(report.verificationStatus), text(report.imageUrl)]] }],
    notes: [
      "Archive metadata only. Uploaded attachment contents and lottery metrics are not included in this report.",
      "Not recorded means the value is unavailable in the loaded archive record. Original evidence remains separate.",
    ],
  };
}
