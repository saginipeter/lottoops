import type { ReportDocument } from "@/lib/report-document";
import { formatReportTimestamp } from "@/lib/report-timestamp";

export interface BackStockSummary {
  generatedAt: string;
  totalPackQuantity: number;
  totalRetailValue: number;
  costPayout95: number;
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

export function buildBackStockSummaryDocument(summary: BackStockSummary): ReportDocument {
  return {
    title: "Back Stock Summary Report",
    paper: "A4",
    metadata: [{ label: "Snapshot generated", value: formatReportTimestamp(summary.generatedAt) }],
    sections: [{
      title: "Current Back Stock Totals",
      columns: ["Total Pack Quantity", "Total Retail Value (100%)", "Cost Payout (95%)"],
      rows: [[summary.totalPackQuantity, money(summary.totalRetailValue), money(summary.costPayout95)]],
    }],
    notes: ["Counts current BACK_STOCK packs for this store. This is a pack count, not a ticket count."],
  };
}
