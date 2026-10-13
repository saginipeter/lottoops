import type { ReportDocument } from "@/lib/report-document";

export interface ShiftReportData {
  id: string;
  terminalId?: string | null;
  status?: string;
  openedAt: string;
  closedAt: string | null;
  openedBy: string;
  closedBy: string;
  grossSales: number;
  cogs: number;
  netMargin: number;
  ticketsSold: number;
  lines: Array<{
    pack: string; game: string; display: string; beginning: number | null;
    ending: number | null; ticketsSold: number | null; sales: number | null;
  }>;
  audit: Array<{
    pack: string; display?: string; direction?: string; beginning: number | null;
    expected: number | null; ending: number | null; variance: number | null;
  }>;
  cash?: {
    openingCash: number | null; expectedCash: number | null; countedCash: number | null;
    cashVariance: number | null; reconciledAt: string | null; reconciledBy: string | null;
  } | null;
}

const missing = "Not recorded";
const money = (value: number | null | undefined) => value == null
  ? missing
  : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

export function shiftReportTimestamp(value: string | null | undefined) {
  if (!value) return missing;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? missing : date.toISOString().replace("T", " ").replace("Z", " UTC");
}

export function createShiftReportDocument(shift: ShiftReportData): ReportDocument {
  return {
    title: "Shift Sales & Reconciliation Report",
    subtitle: shift.status === "OPEN" ? "In progress — provisional ticket movement" : "Completed shift",
    metadata: [
      { label: "Shift ID", value: shift.id },
      { label: "Terminal", value: shift.terminalId ?? missing },
      { label: "Opened by", value: shift.openedBy },
      { label: "Opened at", value: shiftReportTimestamp(shift.openedAt) },
      { label: "Closed by", value: shift.closedBy },
      { label: "Closed at", value: shiftReportTimestamp(shift.closedAt) },
    ],
    sections: [
      {
        title: "Ticket positions & sales volume",
        columns: ["Display", "Pack", "Game", "Opening position", shift.status === "OPEN" ? "Current position" : "Closing position", "Tickets sold", "Sales"],
        rows: shift.lines.length ? shift.lines.map((line) => [
          line.display, line.pack, line.game, line.beginning ?? missing,
          line.ending ?? missing, line.ticketsSold ?? missing, money(line.sales),
        ]) : [[missing, missing, missing, missing, missing, missing, missing]],
      },
      {
        title: "Physical inventory audit — variance = observed closing − expected",
        columns: ["Display", "Pack", "Sell order", "Opening observed", "Closing expected", "Closing observed", "Ticket variance"],
        rows: shift.audit.length ? shift.audit.map((line) => [
          line.display ?? missing, line.pack, line.direction ?? missing, line.beginning ?? missing,
          line.expected ?? missing, line.ending ?? missing, line.variance ?? missing,
        ]) : [[missing, missing, missing, missing, missing, missing, missing]],
      },
      {
        title: "Recorded cash reconciliation",
        columns: ["Measure", "Value"],
        rows: [
          ["Opening drawer", money(shift.cash?.openingCash)],
          ["Expected drawer (recorded at close)", money(shift.cash?.expectedCash)],
          ["Counted drawer", money(shift.cash?.countedCash)],
          ["Cash variance", money(shift.cash?.cashVariance)],
          ["Reconciled at", shiftReportTimestamp(shift.cash?.reconciledAt)],
          ["Reconciled by", shift.cash?.reconciledBy ?? missing],
          ["Cash sales", missing],
          ["Card sales", missing],
          ["Returns", missing],
          ["Voids", missing],
        ],
      },
    ],
    totals: [
      { label: "Tickets sold", value: shift.ticketsSold },
      { label: "Gross sales", value: money(shift.grossSales) },
      { label: "Estimated inventory cost (95% of face value)", value: money(shift.cogs) },
      { label: "Estimated margin", value: money(shift.netMargin) },
    ],
  };
}
