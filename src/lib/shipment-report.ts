import type { ReportDocument } from "@/lib/report-document";

type Amount = number | string | { toString(): string } | null;
type Timestamp = string | Date | null;

export interface ShipmentReportData {
  id: string;
  invoiceNumber: string;
  invoicePhoto: string | null;
  shipmentConfirmationNumber: string | null;
  confirmationReceiptPhoto: string | null;
  supplierName?: string | null;
  supplierDetails?: string | null;
  expectedInventoryCost?: Amount;
  expectedPacks: number;
  scannedPacks: number;
  status: string;
  shipmentDate: Timestamp;
  createdAt: Timestamp;
  confirmedAt: Timestamp;
  receivedBy: { name: string } | null;
  store: { name: string; storeNumber: string | null; address: string | null; phone: string | null; timezone: string };
  packs: Array<{
    id: string;
    gameNumber: string | null;
    packNumber: string | null;
    serialNumber: string;
    ticketPrice: Amount;
    ticketQuantity: number | null;
    firstTicket: number | null;
    cost: Amount;
    retailValue: Amount;
    status: string;
    receivedAt: Timestamp;
    game: { name: string };
  }>;
}

const money = (amount: Amount | undefined) => amount == null ? "Not recorded" : `$${Number(amount).toFixed(2)}`;
const recorded = (value: string | null | undefined) => value?.trim() || "Not recorded";
const timestamp = (value: Timestamp) => value ? new Date(value).toISOString() : "Not recorded";
const cents = (value: Amount) => Math.round(Number(value ?? 0) * 100);

export function shipmentFinancialTotals(shipment: ShipmentReportData) {
  return {
    packCount: shipment.packs.length,
    ticketCount: shipment.packs.reduce((sum, pack) => sum + (pack.ticketQuantity ?? 0), 0),
    retailValue: shipment.packs.reduce((sum, pack) => sum + cents(pack.retailValue), 0) / 100,
    inventoryCost: shipment.packs.reduce((sum, pack) => sum + cents(pack.cost), 0) / 100,
  };
}

export function buildShipmentReport(shipment: ShipmentReportData): ReportDocument {
  const totals = shipmentFinancialTotals(shipment);
  return {
    title: "Receiving Shipment Record",
    subtitle: `Invoice ${shipment.invoiceNumber} · ${shipment.store.name}`,
    paper: "A4",
    metadata: [
      { label: "Shipment ID", value: shipment.id },
      { label: "Store", value: shipment.store.name },
      { label: "Store number", value: recorded(shipment.store.storeNumber) },
      { label: "Store address", value: recorded(shipment.store.address) },
      { label: "Store phone", value: recorded(shipment.store.phone) },
      { label: "Store timezone", value: shipment.store.timezone },
      { label: "Supplier", value: recorded(shipment.supplierName) },
      { label: "Supplier details", value: recorded(shipment.supplierDetails) },
      { label: "Received by", value: recorded(shipment.receivedBy?.name) },
      { label: "Invoice number", value: shipment.invoiceNumber },
      { label: "Confirmation number", value: recorded(shipment.shipmentConfirmationNumber) },
      { label: "Shipment date", value: timestamp(shipment.shipmentDate) },
      { label: "Created at (UTC)", value: timestamp(shipment.createdAt) },
      { label: "Confirmed at (UTC)", value: timestamp(shipment.confirmedAt) },
      { label: "Status", value: shipment.status.replaceAll("_", " ") },
      { label: "Expected packs", value: shipment.expectedPacks },
      { label: "Recorded packs", value: totals.packCount },
      { label: "Entered inventory cost", value: money(shipment.expectedInventoryCost) },
      { label: "Invoice photo", value: shipment.invoicePhoto ? "Recorded" : "Not recorded" },
      { label: "Confirmation receipt photo", value: shipment.confirmationReceiptPhoto ? "Recorded" : "Not recorded" },
    ],
    sections: [{
      title: "Received packs",
      columns: ["Game / name", "Pack / serial", "First ticket", "Tickets", "Ticket price", "Face value", "Inventory cost", "Status"],
      rows: shipment.packs.map((pack) => [
        `${recorded(pack.gameNumber)} / ${pack.game.name}`,
        `${recorded(pack.packNumber)} / ${pack.serialNumber}`,
        pack.firstTicket, pack.ticketQuantity, money(pack.ticketPrice), money(pack.retailValue),
        money(pack.cost), pack.status.replaceAll("_", " "),
      ]),
      totals: ["Totals", `${totals.packCount} packs`, "", totals.ticketCount, "", money(totals.retailValue), money(totals.inventoryCost), ""],
    }],
    notes: ["Financial totals use the recorded receiving values for each pack. Timestamps are UTC."],
  };
}

export async function loadShipmentReport(id: string): Promise<ReportDocument> {
  const response = await fetch(`/api/shipments/${encodeURIComponent(id)}`, { cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Unable to load shipment report.");
  return buildShipmentReport(data as ShipmentReportData);
}
