import type { ReportDocument } from "./report-document";
import { calculatePhysicalAuditVariance } from "./core-validation";

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
  storeName: string;
  terminalId: string | null;
  openedAt: string;
  closedAt: string | null;
  openedBy: string;
  closedBy: string | null;
  grossSales: number;
  ticketsSold: number;
  gameBreakdown: ShiftGameSummary[];
  packSales: Array<{
    pack: string; game: string; display: string;
    beginning: number; ending: number | null; tickets: number | null; sales: number | null;
  }>;
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

function salesSummary(shift: ShiftReportData): ReportDocument["sections"][number] {
  const sumCount = (field: "totalTickets" | "activeStock") =>
    shift.gameBreakdown.some((game) => game[field] == null)
      ? NOT_RECORDED
      : shift.gameBreakdown.reduce((sum, game) => sum + (game[field] ?? 0), 0);
  return {
    title: "Sales Summary",
    columns: ["Game Name / ID", "Total Tickets", "Tickets Sold", "Active Stock", "Gross Sales (100%)", "Cost / Payout (95%)"],
    rows: shift.gameBreakdown.map((game) => [
      `${game.name}${game.gameNumber || game.id ? ` / ${game.gameNumber || game.id}` : ""}`,
      game.totalTickets ?? NOT_RECORDED, game.tickets, game.activeStock ?? NOT_RECORDED,
      money(game.sales), money(game.cost),
    ]),
    totals: [
      "TOTAL SHIFT SUMMARY", sumCount("totalTickets"), shift.ticketsSold, sumCount("activeStock"),
      money(shift.grossSales), money(shift.gameBreakdown.reduce((sum, game) => sum + game.cost, 0)),
    ],
  };
}

export function buildShiftReportDocument(shift: ShiftReportData): ReportDocument {
  return {
    title: "Shift Sales & Audit Report",
    subtitle: shift.storeName,
    paper: "A4",
    metadata: [
      { label: "Shift ID", value: shift.id },
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
      {
        title: "Pack Ticket Counts",
        columns: ["Display", "Pack / Game", "Opening remaining", "Closing remaining", "Tickets sold", "Sales"],
        rows: shift.packSales.map((line) => [
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
        columns: ["Display / Pack", "Direction", "Opening expected", "Opening physical", "Closing expected", "Closing physical", "Ticket variance"],
        rows: shift.audit.map((line) => [
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
        columns: ["Display / Pack", "Beginning tickets", "Sales", "Expected ending", "Unsold remaining"],
        rows: shift.audit.map((line) => [
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
  const audits = shift.audit.map((line) => ({
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
      { label: "Shift ID", value: shift.id },
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
        title: "Ticket Variances",
        columns: ["Display / Pack", "Expected ticket", "Counted ticket", "Variance"],
        rows: exceptions.map((line) => [
          `${line.display ?? NOT_RECORDED} / ${line.pack}`, line.expected, line.ending, line.variance,
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
