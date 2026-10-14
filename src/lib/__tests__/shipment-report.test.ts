import assert from "node:assert/strict";
import test from "node:test";
import { buildShipmentReport, loadShipmentReport, shipmentFinancialTotals, type ShipmentReportData } from "@/lib/shipment-report";
import { readShipmentDetail } from "@/lib/shipment-detail";
import { shipmentMetadataInput } from "@/lib/shipment-input";
import { renderReportDocument } from "@/lib/report-document";

const shipment: ShipmentReportData = {
  id: "shipment-1",
  invoiceNumber: "INV-123",
  invoicePhoto: "/invoice.jpg",
  shipmentConfirmationNumber: "CONF-987",
  confirmationReceiptPhoto: null,
  supplierName: "State lottery",
  supplierDetails: "100 Main Street\n555-0100",
  expectedInventoryCost: "95.00",
  expectedPacks: 1,
  scannedPacks: 1,
  status: "RECEIVED",
  shipmentDate: "2026-10-13T00:00:00.000Z",
  createdAt: "2026-10-14T12:00:00.000Z",
  confirmedAt: "2026-10-14T12:05:00.000Z",
  receivedBy: { name: "Canonical receiver" },
  store: { name: "Main store", storeNumber: "1", address: "1 State Street", phone: "555-0200", timezone: "America/Chicago" },
  packs: [{
    id: "pack-1", gameNumber: "1234", packNumber: "567890", serialNumber: "1234567890001",
    ticketPrice: "2.00", ticketQuantity: 50, firstTicket: 1, cost: "95.00", retailValue: "100.00",
    status: "BACK_STOCK", receivedAt: "2026-10-14T12:01:00.000Z", game: { name: "Lucky game" },
  }],
};

test("shipment A4 template contains canonical supplier, receiver, timestamps, packs and totals", () => {
  const report = buildShipmentReport(shipment);
  assert.equal(report.paper, "A4");
  assert.equal(report.metadata?.find((item) => item.label === "Supplier")?.value, "State lottery");
  assert.equal(report.metadata?.find((item) => item.label === "Received by")?.value, "Canonical receiver");
  assert.equal(report.metadata?.find((item) => item.label === "Confirmed at (UTC)")?.value, shipment.confirmedAt);
  assert.deepEqual(report.sections[0].rows[0], ["1234 / Lucky game", "567890 / 1234567890001", 1, 50, "$2.00", "$100.00", "$95.00", "BACK STOCK"]);
  assert.deepEqual(report.sections[0].totals, ["Totals", "1 packs", "", 50, "", "$100.00", "$95.00", ""]);
});

test("legacy missing supplier and timestamps are explicitly not recorded", () => {
  const report = buildShipmentReport({ ...shipment, supplierName: undefined, supplierDetails: null, receivedBy: null, confirmedAt: null, expectedInventoryCost: null, packs: [] });
  for (const label of ["Supplier", "Supplier details", "Received by", "Confirmed at (UTC)", "Entered inventory cost"]) {
    assert.equal(report.metadata?.find((item) => item.label === label)?.value, "Not recorded");
  }
  assert.deepEqual(report.sections[0].rows, []);
});

test("stored financial amounts sum in cents, not floating point or ticket assumptions", () => {
  const pack = shipment.packs[0];
  assert.deepEqual(shipmentFinancialTotals({ ...shipment, packs: [
    { ...pack, cost: "0.10", retailValue: "0.10" }, { ...pack, cost: "0.20", retailValue: "0.20" },
  ] }), { packCount: 2, ticketCount: 100, retailValue: 0.3, inventoryCost: 0.3 });
});

test("supplier text is escaped by the shared rendering contract", () => {
  const html = renderReportDocument(buildShipmentReport({ ...shipment, supplierName: '<script>alert("x")</script>' }));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(!html.includes("<script>"));
});

test("detail lookup scopes shipment and packs to the authenticated store and reads receiver relation", async () => {
  const db = { shipment: { findFirst: async (args: Parameters<Parameters<typeof readShipmentDetail>[0]["shipment"]["findFirst"]>[0]) => {
    assert.deepEqual(args.where, { id: "shipment-1", storeId: "store-1" });
    assert.deepEqual(args.include.packs.where, { storeId: "store-1" });
    assert.deepEqual(args.include.receivedBy, { select: { name: true } });
    return shipment;
  } } };
  const detail = await readShipmentDetail(db, "shipment-1", "store-1");
  assert.equal(detail?.receivedBy?.name, "Canonical receiver");
  assert.equal(detail?.totals.inventoryCost, 95);
});

test("foreign-store and missing shipments produce no report data", async () => {
  const db = { shipment: { findFirst: async () => null } };
  assert.equal(await readShipmentDetail(db, "foreign-shipment", "store-1"), null);
});

test("POST, PATCH and resume metadata preserve omitted fields, normalize text, allow explicit clearing and ignore receiver spoofing", () => {
  assert.deepEqual(shipmentMetadataInput({}), {});
  assert.deepEqual(shipmentMetadataInput({ supplierName: " State lottery ", supplierDetails: " Contact ", expectedRetailValue: 95, receivedById: "spoof", receivedBy: "Fake" }), {
    supplierName: "State lottery", supplierDetails: "Contact", expectedInventoryCost: 95,
  });
  assert.deepEqual(shipmentMetadataInput({ supplierName: "", supplierDetails: null }), { supplierName: null, supplierDetails: null });
  assert.throws(() => shipmentMetadataInput({ supplierName: {} }));
  assert.throws(() => shipmentMetadataInput({ supplierDetails: "a".repeat(2001) }));
  assert.throws(() => shipmentMetadataInput({ expectedRetailValue: "invalid" }));
});

test("lazy archive and completion loading selects only the requested shipment", async () => {
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = async (input) => {
    calls.push(String(input));
    return Response.json(shipment);
  };
  try {
    assert.deepEqual(await loadShipmentReport("shipment-1"), buildShipmentReport(shipment));
    assert.deepEqual(calls, ["/api/shipments/shipment-1"]);
  } finally { globalThis.fetch = originalFetch; }
});
