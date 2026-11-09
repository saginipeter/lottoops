import type { ReportDocument } from "./report-document";
import { calculatePhysicalAuditVariance } from "./core-validation";
import { compareDisplayNumberLabels, formatDisplayNumberLabel } from "./display-number-order";
import type { OperatorSessionSales } from "./shift-session-sales";

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
  cash: {
    openingCash: number | null; expectedCash: number | null; countedCash: number | null;
    cashVariance: number | null; reconciledAt: string | null; reconciledBy: string | null;
  };
}

const NOT_RECORDED = "Not recorded";
const money = (value: number | null | undefined) => value == null
  ? NOT_RECORDED
  : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
const timestamp = (value: string | null) => value
  ? new Date(value).toISOString().replace("T", " ").replace(".000Z", " UTC")
  : NOT_RECORDED;

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
    title: "Sales Summary",
    columns: ["Game / Game #", "Total Tickets", "Tickets Sold", "Active Stock", "Gross Sales (100%)", "Cost / Payout (95%)"],
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
      title: "Sales by Employee Login & Terminal",
      columns: ["Employee", "Terminal", "Shift", "Signed in", "Signed out", "Tickets", "Gross Sales", "Price source"],
      rows: sessions.length ? sessions.map((session) => [
        session.employeeName,
        session.terminalId ?? NOT_RECORDED,
        shiftNumber == null ? NOT_RECORDED : `Shift ${shiftNumber}`,
        session.signedInAt ? timestamp(new Date(session.signedInAt).toISOString()) : NOT_RECORDED,
        session.endedAt ? timestamp(new Date(session.endedAt).toISOString()) : "Still signed in",
        session.tickets,
        money(session.grossSales),
        session.hasEstimatedPrice ? "Backfilled estimate" : "Recorded",
      ]) : [["No ticket sales recorded", NOT_RECORDED, NOT_RECORDED, NOT_RECORDED, NOT_RECORDED, 0, money(0), NOT_RECORDED]],
    },
    {
      title: "Employee & Terminal Pack Breakdown",
      columns: ["Employee", "Terminal", "Display #", "Pack / Game", "Tickets", "Gross Sales", "First sale", "Last sale", "Price source"],
      rows: sessions.flatMap((session) => session.packs.map((pack) => [
        session.employeeName,
        session.terminalId ?? NOT_RECORDED,
        formatDisplayNumberLabel(pack.display),
        `${pack.pack} / ${pack.game}`,
        pack.tickets,
        money(pack.grossSales),
        pack.firstSaleAt ? timestamp(new Date(pack.firstSaleAt).toISOString()) : NOT_RECORDED,
        pack.lastSaleAt ? timestamp(new Date(pack.lastSaleAt).toISOString()) : NOT_RECORDED,
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
      { label: "Signed in", value: shift.operatorSessions?.[0]?.signedInAt ? timestamp(new Date(shift.operatorSessions[0].signedInAt).toISOString()) : NOT_RECORDED },
      { label: "Shift opened", value: timestamp(shift.openedAt) },
      { label: "Shift closed", value: timestamp(shift.closedAt) },
    ],
    sections: operatorSessionSections(shift.operatorSessions, shift.shiftNumber),
    notes: [
      "This report is scoped to the authenticated employee login session. It does not include other employees' sales, shared shift totals, cash drawer values, or audit details.",
      ...(shift.operatorSessions?.some((session) => session.hasEstimatedPrice)
        ? ["Some historical sale prices were backfilled from the pack's configured ticket price; those values are labeled as estimates."]
        : []),
    ],
  };
}

export function buildShiftReportDocument(shift: ShiftReportData): ReportDocument {
  if (shift.operatorSessionsOnly) return buildLoginSessionReportDocument(shift, "Employee Login Sales Report");
  return {
    title: "Shift Sales & Audit Report",
    subtitle: shift.storeName,
    paper: "A4",
    metadata: [
      { label: "Shift", value: shift.shiftNumber == null ? NOT_RECORDED : `Shift ${shift.shiftNumber}` },
      { label: "Terminal", value: shift.terminalId ?? NOT_RECORDED },
      { label: "Opened", value: timestamp(shift.openedAt) },
      { label: "Opened by", value: shift.openedBy },
      { label: "Closed", value: timestamp(shift.closedAt) },
      { label: "Closed by", value: shift.closedBy ?? NOT_RECORDED },
      { label: "Opening audit operator", value: shift.auditOpenedBy ?? NOT_RECORDED },
      { label: "Opening audit time", value: timestamp(shift.auditOpenedAt) },
      { label: "Closing audit operator", value: shift.auditClosedBy ?? NOT_RECORDED },
      { label: "Closing audit time", value: timestamp(shift.auditClosedAt) },
    ],
    sections: [
      salesSummary(shift),
      ...operatorSessionSections(shift.operatorSessions, shift.shiftNumber),
      {
        title: "Pack Ticket Counts",
        columns: ["Display #", "Pack / Game", "Opening remaining", "Closing remaining", "Tickets sold", "Sales"],
        rows: orderedPackSales(shift.packSales).map((line) => [
          line.display, `${line.pack} / ${line.game}`, line.beginning,
          line.ending ?? NOT_RECORDED, line.tickets ?? NOT_RECORDED, money(line.sales),
        ]),
      },
      {
        title: "Payment Recording",
        columns: ["Category", "Amount"],
        rows: [["Cash sales", NOT_RECORDED], ["Card sales", NOT_RECORDED], ["Returns", NOT_RECORDED], ["Voids", NOT_RECORDED]],
      },
      {
        title: "Recorded Cash Reconciliation",
        columns: ["Field", "Recorded value"],
        rows: [
          ["Opening drawer cash", money(shift.cash.openingCash)],
          ["Recorded expected cash", money(shift.cash.expectedCash)],
          ["Counted closing cash", money(shift.cash.countedCash)],
          ["Recorded cash variance", money(shift.cash.cashVariance)],
          ["Reconciled by", shift.cash.reconciledBy ?? NOT_RECORDED],
          ["Reconciled at", timestamp(shift.cash.reconciledAt)],
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
        columns: ["Display # / Pack", "Beginning tickets", "Sales", "Expected ending", "Unsold remaining"],
        rows: orderedAudit(shift.audit).map((line) => [
          `${line.display ?? NOT_RECORDED} / ${line.pack}`,
          line.beginningTickets ?? NOT_RECORDED, line.salesTickets ?? NOT_RECORDED,
          line.expectedEndingTickets ?? NOT_RECORDED, line.endingTickets ?? NOT_RECORDED,
        ]),
      },
    ],
    notes: [
      "Total tickets are opening available stock; active stock is closing unsold stock for this shift. Cost / Payout is 95% of gross sales, not recorded prize payments.",
      "Cash/card payment breakdown, returns, and voids are not recorded by this system. Total ticket sales must not be treated as cash sales.",
      "Expected cash and cash variance above are recorded reconciliation values, not a payment-method breakdown.",
      "Ticket audit variance = closing physical ticket number minus closing expected ticket number. Ticket numbers follow the pack direction; remaining counts are shown separately.",
      "Beginning tickets − sales = expected ending tickets in either direction. Already sold tickets are excluded from unsold remaining counts.",
    ],
  };
}

export function buildEndOfShiftReportDocument(shift: ShiftReportData): ReportDocument {
  if (shift.operatorSessionsOnly) return buildLoginSessionReportDocument(shift, "Employee Login Sales Report");
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
      { label: "Report date (UTC)", value: shift.closedAt?.slice(0, 10) ?? NOT_RECORDED },
      { label: "Opened", value: timestamp(shift.openedAt) },
      { label: "Closed", value: timestamp(shift.closedAt) },
      { label: "Opened by", value: shift.openedBy },
      { label: "Closed by", value: shift.closedBy ?? NOT_RECORDED },
    ],
    sections: [
      {
        title: "Shift Statistics",
        columns: ["Statistic", "Total"],
        rows: [
          ["Tickets sold", shift.ticketsSold],
          ["Total sales", money(shift.grossSales)],
        ],
      },
      ...operatorSessionSections(shift.operatorSessions, shift.shiftNumber),
      {
        title: "Cash & Variance",
        columns: ["Cash", "Amount"],
        rows: [
          ["Opening drawer cash", money(shift.cash.openingCash)],
          ["Recorded expected cash", money(shift.cash.expectedCash)],
          ["Counted closing cash", money(shift.cash.countedCash)],
          ["Recorded cash variance", money(shift.cash.cashVariance)],
        ],
      },
      {
        title: "Pack Sales by Display",
        columns: ["Display #", "Pack", "Game", "Beginning", "Ending", "Tickets Sold", "Gross Sales", "Cost (95%)"],
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
      "Ticket variance = counted closing ticket number minus expected ticket number. Cash variance is the recorded reconciliation value.",
      "Not recorded means unavailable, not zero. Cash/card sales, returns, and voids are not tracked separately.",
      "Total tickets are opening available stock; active stock is closing unsold stock for this shift. Cost / Payout is 95% of gross sales, not recorded prize payments.",
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
