import type { ReportDocument } from "./report-document";

export interface ReceivingShipmentReport {
  id: string;
  invoiceNumber: string;
  supplierDetails: string | null;
  shipmentConfirmationNumber: string | null;
  shipmentDate: string | null;
  confirmedAt: string | null;
  status: string;
  expectedPacks: number;
  receivedBy: { name: string };
  packs: Array<{
    id: string;
    serialNumber: string;
    packNumber: string | null;
    gameNumber: string | null;
    ticketPrice: string | number | null;
    ticketQuantity: number | null;
    cost: string | number;
    retailValue: string | number;
    game: { name: string; gameNumber: string; price: string | number; ticketsPerPack: number };
  }>;
}

function money(value: string | number) {
  return `$${Number(value).toFixed(2)}`;
}

function dateOnly(value: string | null) {
  return value ? value.slice(0, 10) : "Not recorded";
}

export function buildReceivingReportDocument(shipment: ReceivingShipmentReport): ReportDocument {
  const totalCost = shipment.packs.reduce((sum, pack) => sum + Number(pack.cost), 0);
  const totalRetail = shipment.packs.reduce((sum, pack) => sum + Number(pack.retailValue), 0);
  const totalTickets = shipment.packs.reduce((sum, pack) => sum + (pack.ticketQuantity ?? pack.game.ticketsPerPack), 0);

  return {
    title: "Receiving Shipment Record",
    subtitle: `Invoice ${shipment.invoiceNumber}`,
    metadata: [
      { label: "Invoice number", value: shipment.invoiceNumber },
      { label: "Confirmation number", value: shipment.shipmentConfirmationNumber || "Not recorded" },
      { label: "Supplier details", value: shipment.supplierDetails || "Not recorded" },
      { label: "Shipment date", value: dateOnly(shipment.shipmentDate) },
      { label: "Confirmed at", value: shipment.confirmedAt ? new Date(shipment.confirmedAt).toISOString() : "Not confirmed" },
      { label: "Received by", value: shipment.receivedBy.name },
      { label: "Status", value: shipment.status.replaceAll("_", " ") },
      { label: "Expected packs", value: shipment.expectedPacks },
    ],
    sections: [{
      title: "Received pack line items",
      columns: ["Game #", "Game", "Pack #", "Serial number", "Tickets", "Ticket price", "Inventory cost", "Retail value"],
      rows: shipment.packs.map((pack) => [
        pack.gameNumber || pack.game.gameNumber,
        pack.game.name,
        pack.packNumber,
        pack.serialNumber,
        pack.ticketQuantity ?? pack.game.ticketsPerPack,
        money(pack.ticketPrice ?? pack.game.price),
        money(pack.cost),
        money(pack.retailValue),
      ]),
    }],
    totals: [
      { label: "Recorded packs", value: shipment.packs.length },
      { label: "Total tickets", value: totalTickets },
      { label: "Total inventory cost", value: money(totalCost) },
      { label: "Total retail value", value: money(totalRetail) },
    ],
  };
}
