import type { ReportDocument } from "./report-document";
import { calculatePhysicalAuditVariance } from "./core-validation";
import { compareDisplayNumberLabels, formatDisplayNumberLabel } from "./display-number-order";
import type { OperatorSessionSales } from "./shift-session-sales";
import { formatReportDate, formatReportTimestamp } from "./report-timestamp";

export interface ShiftGameSummary {
  id?: string;
  gameNumber?: string | null;
  name: string;
  totalTickets?: number;
  tickets: number;
  activeStock?: number | null;
  sales: number;
  cost: number;
}

export interface ShiftReportData {
  id: string;
  shiftNumber?: number | null;
  storeName: string;
  terminalId: string | null;
  openedAt: string;
  closedAt: string | null;
  openedBy: string;
  closedBy: string | null;
  grossSales: number;
  cogs?: number;
  ticketsSold: number;
  registerScratchOffSales?: number | null;
  registerSalesRecordedAt?: string | null;
  registerSalesRecordedBy?: string | null;
  gameBreakdown: ShiftGameSummary[];
  packSales: Array<{
    pack: string; game: string; display: string;
    beginning: number; ending: number | null; tickets: number | null; sales: number | null;
  }>;
  operatorSessions?: OperatorSessionSales[];
  operatorSessionsOnly?: boolean;
  audit: Array<{
    pack: string; display?: string; direction?: string;
    beginningExpected: number | null; beginning: number | null;
    expected: number | null; ending: number | null;
    beginningTickets?: number | null; salesTickets?: number | null;
    expectedEndingTickets?: number | null; endingTickets?: number | null;
  }>;
  auditOpenedBy: string | null;
  auditClosedBy: string | null;
  auditOpenedAt: string | null;
  auditClosedAt: string | null;
}

const NOT_RECORDED = "Not recorded";
const money = (value: number | null | undefined) => value == null
  ? NOT_RECORDED
  : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
const timestamp = (value: string | Date | null) => value
  ? formatReportTimestamp(value)
  : NOT_RECORDED;
const reportTimestamp = (value: string | Date | null) => value ? formatReportTimestamp(value) : NOT_RECORDED;

function orderedPackSales(lines: ShiftReportData["packSales"]) {
  return [...lines].sort((left, right) =>
    compareDisplayNumberLabels(left.display, right.display) || left.pack.localeCompare(right.pack, undefined, { numeric: true }),
  );
}

function orderedAudit(lines: ShiftReportData["audit"]) {
  return [...lines].sort((left, right) =>
    compareDisplayNumberLabels(left.display, right.display) || left.pack.localeCompare(right.pack, undefined, { numeric: true }),
  );
}

function salesSummary(shift: ShiftReportData): ReportDocument["sections"][number] {
  const sumCount = (field: "totalTickets" | "activeStock") =>
    shift.gameBreakdown.some((game) => game[field] == null)
      ? NOT_RECORDED
      : shift.gameBreakdown.reduce((sum, game) => sum + (game[field] ?? 0), 0);
  return {
    title: "Ticket Tracking Summary",
    columns: ["Game / Game #", "Total Tickets", "Tickets Tracked", "Active Stock", "Ticket Value (100%)", "Cost / Payout (95%)"],
    rows: shift.gameBreakdown.map((game) => [
      `${game.name}${game.gameNumber ? ` / ${game.gameNumber}` : ""}`,
      game.totalTickets ?? NOT_RECORDED, game.tickets, game.activeStock ?? NOT_RECORDED,
      money(game.sales), money(game.cost),
    ]),
    totals: [
      "TOTAL SHIFT SUMMARY", sumCount("totalTickets"), shift.ticketsSold, sumCount("activeStock"),
      money(shift.grossSales), money(shift.cogs ?? Math.round((shift.grossSales * 0.95 + Number.EPSILON) * 100) / 100),
    ],
  };
}

function operatorSessionSections(sessions: OperatorSessionSales[] | undefined, shiftNumber?: number | null): ReportDocument["sections"] {
  if (!sessions) return [];
  return [
    {
      title: "Ticket Tracking by Employee Login & Terminal",
      columns: ["Employee", "Terminal", "Shift", "Signed in", "Signed out", "Tickets Tracked", "Ticket Value", "Price source"],
      rows: sessions.length ? sessions.map((session) => [
        session.employeeName,
        session.terminalId ?? NOT_RECORDED,
        shiftNumber == null ? NOT_RECORDED : `Shift ${shiftNumber}`,
        session.signedInAt ? reportTimestamp(session.signedInAt) : NOT_RECORDED,
        session.endedAt ? reportTimestamp(session.endedAt) : "Still signed in",
        session.tickets,
        money(session.grossSales),
        session.hasEstimatedPrice ? "Backfilled estimate" : "Recorded",
      ]) : [["No tickets tracked", NOT_RECORDED, NOT_RECORDED, NOT_RECORDED, NOT_RECORDED, 0, money(0), NOT_RECORDED]],
    },
    {
      title: "Employee & Terminal Pack Tracking",
      columns: ["Employee", "Terminal", "Display #", "Pack / Game", "Tickets Tracked", "Ticket Value", "First tracked", "Last tracked", "Price source"],
      rows: sessions.flatMap((session) => session.packs.map((pack) => [
        session.employeeName,
        session.terminalId ?? NOT_RECORDED,
        formatDisplayNumberLabel(pack.display),
        `${pack.pack} / ${pack.game}`,
        pack.tickets,
        money(pack.grossSales),
        pack.firstSaleAt ? reportTimestamp(pack.firstSaleAt) : NOT_RECORDED,
        pack.lastSaleAt ? reportTimestamp(pack.lastSaleAt) : NOT_RECORDED,
        pack.hasEstimatedPrice ? "Backfilled estimate" : "Recorded",
      ])),
    },
  ];
}

function buildLoginSessionReportDocument(shift: ShiftReportData, title: string): ReportDocument {
  return {
    title,
    subtitle: shift.storeName,
    paper: "A4",
    metadata: [
      { label: "Employee", value: shift.operatorSessions?.[0]?.employeeName ?? shift.openedBy },
      { label: "Terminal", value: shift.terminalId ?? NOT_RECORDED },
      { label: "Shift", value: shift.shiftNumber == null ? NOT_RECORDED : `Shift ${shift.shiftNumber}` },
      { label: "Signed in", value: shift.operatorSessions?.[0]?.signedInAt ? reportTimestamp(shift.operatorSessions[0].signedInAt) : NOT_RECORDED },
      { label: "Shift opened", value: timestamp(shift.openedAt) },
      { label: "Shift closed", value: timestamp(shift.closedAt) },
    ],
    sections: operatorSessionSections(shift.operatorSessions, shift.shiftNumber),
    notes: [
      "This report is scoped to the authenticated employee login session. It does not include other employees' tracked tickets, shared shift totals, register reconciliation, or audit details.",
      ...(shift.operatorSessions?.some((session) => session.hasEstimatedPrice)
        ? ["Some historical ticket prices were backfilled from the pack's configured ticket price; those values are labeled as estimates."]
        : []),
    ],
  };
}

export function buildShiftReportDocument(shift: ShiftReportData): ReportDocument {
  if (shift.operatorSessionsOnly) return buildLoginSessionReportDocument(shift, "Employee Login Ticket Tracking Report");
  return {
    title: "Shift Ticket Tracking & Audit Report",
    subtitle: shift.storeName,
    paper: "A4",
    metadata: [
      { label: "Shift", value: shift.shiftNumber == null ? NOT_RECORDED : `Shift ${shift.shiftNumber}` },
      { label: "Terminal", value: shift.terminalId ?? NOT_RECORDED },
      { label: "Opened", value: timestamp(shift.openedAt) },
      { label: "Opened by", value: shift.openedBy },
      { label: "Closed", value: reportTimestamp(shift.closedAt) },
      { label: "Closed by", value: shift.closedBy ?? NOT_RECORDED },
      { label: "Opening audit operator", value: shift.auditOpenedBy ?? NOT_RECORDED },
      { label: "Opening audit time", value: timestamp(shift.auditOpenedAt) },
      { label: "Closing audit operator", value: shift.auditClosedBy ?? NOT_RECORDED },
      { label: "Closing audit time", value: reportTimestamp(shift.auditClosedAt) },
    ],
    sections: [
      salesSummary(shift),
      ...operatorSessionSections(shift.operatorSessions, shift.shiftNumber),
      {
        title: "Ticket Tracking by Display",
        columns: ["Display #", "Pack / Game", "Opening remaining", "Closing remaining", "Tickets tracked", "Ticket value"],
        rows: orderedPackSales(shift.packSales).map((line) => [
          line.display, `${line.pack} / ${line.game}`, line.beginning,
          line.ending ?? NOT_RECORDED, line.tickets ?? NOT_RECORDED, money(line.sales),
        ]),
      },
      {
        title: "Register Scratch Off Sales",
        columns: ["Field", "Amount"],
        rows: [
          ["System tracked ticket value", money(shift.grossSales)],
          ["Register Scratch Off Sales", money(shift.registerScratchOffSales)],
          ["Difference (register minus system)", shift.registerScratchOffSales == null ? NOT_RECORDED : money(shift.registerScratchOffSales - shift.grossSales)],
          ["Recorded by", shift.registerSalesRecordedBy ?? NOT_RECORDED],
          ["Recorded at", timestamp(shift.registerSalesRecordedAt ?? null)],
        ],
      },
      {
        title: "Physical Ticket Audit",
        columns: ["Display # / Pack", "Direction", "Opening expected", "Opening physical", "Closing expected", "Closing physical", "Ticket variance"],
        rows: orderedAudit(shift.audit).map((line) => [
          `${line.display ?? NOT_RECORDED} / ${line.pack}`, line.direction ?? NOT_RECORDED,
          line.beginningExpected ?? NOT_RECORDED, line.beginning ?? NOT_RECORDED,
          line.expected ?? NOT_RECORDED, line.ending ?? NOT_RECORDED,
          line.expected == null || line.ending == null
            ? NOT_RECORDED
            : calculatePhysicalAuditVariance(line.expected, line.ending) ?? NOT_RECORDED,
        ]),
      },
      {
        title: "Physical Audit Inventory Counts",
        columns: ["Display # / Pack", "Beginning tickets", "Tickets tracked", "Expected ending", "Remaining tickets"],
        rows: orderedAudit(shift.audit).map((line) => [
          `${line.display ?? NOT_RECORDED} / ${line.pack}`,
          line.beginningTickets ?? NOT_RECORDED, line.salesTickets ?? NOT_RECORDED,
          line.expectedEndingTickets ?? NOT_RECORDED, line.endingTickets ?? NOT_RECORDED,
        ]),
      },
    ],
    notes: [
      "Total tickets are opening available stock; active stock is the closing remaining count for this shift. Cost / Payout is 95% of tracked ticket value, not recorded prize payments.",
      "LottoOps tracks tickets and their configured value. It does not track payment methods, returns, or voids.",
      "Ticket audit variance = closing physical ticket number minus closing expected ticket number. Ticket numbers follow the pack direction; remaining counts are shown separately.",
      "Beginning tickets − tickets tracked = expected ending tickets in either direction. Previously tracked tickets are excluded from remaining counts.",
    ],
  };
}

export function buildEndOfShiftReportDocument(shift: ShiftReportData): ReportDocument {
  if (shift.operatorSessionsOnly) return buildLoginSessionReportDocument(shift, "Employee Login Ticket Tracking Report");
  const audits = orderedAudit(shift.audit).map((line) => ({
    ...line,
    variance: line.expected == null || line.ending == null
      ? null : calculatePhysicalAuditVariance(line.expected, line.ending),
  }));
  const exceptions = audits.filter((line) => line.variance !== 0);
  return {
    title: "End of Shift Report",
    subtitle: shift.storeName,
    paper: "A4",
    metadata: [
      { label: "Shift", value: shift.shiftNumber == null ? NOT_RECORDED : `Shift ${shift.shiftNumber}` },
      { label: "Report date", value: shift.closedAt ? formatReportDate(shift.closedAt) : NOT_RECORDED },
      { label: "Opened", value: timestamp(shift.openedAt) },
      { label: "Closed", value: reportTimestamp(shift.closedAt) },
      { label: "Opened by", value: shift.openedBy },
      { label: "Closed by", value: shift.closedBy ?? NOT_RECORDED },
    ],
    sections: [
      {
        title: "Shift Statistics",
        columns: ["Statistic", "Total"],
        rows: [
          ["Tickets tracked", shift.ticketsSold],
          ["Value of tracked tickets", money(shift.grossSales)],
        ],
      },
      ...operatorSessionSections(shift.operatorSessions, shift.shiftNumber),
      {
        title: "Register Scratch Off Sales",
        columns: ["Field", "Amount"],
        rows: [
          ["System tracked ticket value", money(shift.grossSales)],
          ["Register Scratch Off Sales", money(shift.registerScratchOffSales)],
          ["Difference (register minus system)", shift.registerScratchOffSales == null ? NOT_RECORDED : money(shift.registerScratchOffSales - shift.grossSales)],
          ["Recorded by", shift.registerSalesRecordedBy ?? NOT_RECORDED],
          ["Recorded at", timestamp(shift.registerSalesRecordedAt ?? null)],
        ],
      },
      {
        title: "Ticket Tracking by Display",
        columns: ["Display #", "Pack", "Game", "Beginning", "Ending", "Tickets Tracked", "Ticket Value", "Cost (95%)"],
        rows: orderedPackSales(shift.packSales).map((line) => [
          formatDisplayNumberLabel(line.display), line.pack, line.game, line.beginning,
          line.ending ?? NOT_RECORDED, line.tickets ?? NOT_RECORDED,
          money(line.sales), line.sales == null ? NOT_RECORDED : money(Math.round((line.sales * 0.95 + Number.EPSILON) * 100) / 100),
        ]),
      },
      {
        title: "Ticket Variances",
        columns: ["Display # / Pack", "Expected ticket", "Counted ticket", "Variance"],
        rows: exceptions.map((line) => [
          `${formatDisplayNumberLabel(line.display)} / ${line.pack}`, line.expected, line.ending, line.variance,
        ]),
      },
      salesSummary(shift),
    ],
    notes: [
      "Statistics cover this selected shift only, not other shifts on the report date.",
      audits.length
        ? `${audits.filter((line) => line.variance === 0).length} of ${audits.length} audited packs match. Only variances and incomplete counts are listed.`
        : "No physical ticket audit recorded.",
      "Ticket variance = counted closing ticket number minus expected ticket number. Register Scratch Off Sales is compared with ticket value tracked by LottoOps.",
      "Not recorded means unavailable, not zero. LottoOps tracks tickets and their configured value; it does not track payment methods, returns, or voids.",
      "Total tickets are opening available stock; active stock is the closing remaining count for this shift. Cost / Payout is 95% of tracked ticket value, not recorded prize payments.",
    ],
  };
}

export async function loadShiftReportDocument(shiftId: string): Promise<ReportDocument> {
  const response = await fetch(`/api/reports/shifts?shiftId=${encodeURIComponent(shiftId)}`, { cache: "no-store" });
  if (!response.ok) throw new Error("Unable to load this shift report.");
  const data = await response.json() as { shifts: ShiftReportData[] };
  const shift = data.shifts.find((item) => item.id === shiftId);
  if (!shift) throw new Error("Closed shift report not found.");
  return buildEndOfShiftReportDocument(shift);
}
