import assert from "node:assert/strict";
import test from "node:test";
import { buildReceivingReportDocument, type ReceivingShipmentReport } from "@/lib/receiving-report-document";

const shipment: ReceivingShipmentReport = {
  id: "shipment-1",
  invoiceNumber: "INV-101",
  supplierDetails: "State Lottery, 555-0100",
  shipmentConfirmationNumber: "CONF-202",
  shipmentDate: "2026-10-13T00:00:00.000Z",
  confirmedAt: "2026-10-13T17:00:00.000Z",
  status: "RECEIVED",
  expectedPacks: 2,
  receivedBy: { name: "Server-saved receiver" },
  packs: [
    {
      id: "pack-1", serialNumber: "SERIAL-1", packNumber: "001", gameNumber: "101",
      ticketPrice: "5.00", ticketQuantity: 50, cost: "237.50", retailValue: "250.00",
      game: { name: "Lucky Game", gameNumber: "101", price: "5.00", ticketsPerPack: 50 },
    },
    {
      id: "pack-2", serialNumber: "SERIAL-2", packNumber: "002", gameNumber: null,
      ticketPrice: null, ticketQuantity: null, cost: "95.00", retailValue: "100.00",
      game: { name: "Bonus Game", gameNumber: "102", price: "2.00", ticketsPerPack: 50 },
    },
  ],
};

test("receiving report includes saved shipment metadata and authoritative confirmation", () => {
  const report = buildReceivingReportDocument(shipment);
  assert.equal(report.title, "Receiving Shipment Record");
  assert.deepEqual(report.metadata, [
    { label: "Invoice number", value: "INV-101" },
    { label: "Confirmation number", value: "CONF-202" },
    { label: "Supplier details", value: "State Lottery, 555-0100" },
    { label: "Shipment date", value: "2026-10-13" },
    { label: "Confirmed at", value: "2026-10-13T17:00:00.000Z" },
    { label: "Received by", value: "Server-saved receiver" },
    { label: "Status", value: "RECEIVED" },
    { label: "Expected packs", value: 2 },
  ]);
});

test("receiving report lists every pack with stored amounts and reconciled totals", () => {
  const report = buildReceivingReportDocument(shipment);
  assert.deepEqual(report.sections[0].rows, [
    ["101", "Lucky Game", "001", "SERIAL-1", 50, "$5.00", "$237.50", "$250.00"],
    ["102", "Bonus Game", "002", "SERIAL-2", 50, "$2.00", "$95.00", "$100.00"],
  ]);
  assert.deepEqual(report.totals, [
    { label: "Recorded packs", value: 2 },
    { label: "Total tickets", value: 100 },
    { label: "Total inventory cost", value: "$332.50" },
    { label: "Total retail value", value: "$350.00" },
  ]);
});

test("legacy and in-progress shipments never fabricate a confirmation or supplier", () => {
  const report = buildReceivingReportDocument({
    ...shipment, supplierDetails: null, shipmentDate: null, confirmedAt: null,
    shipmentConfirmationNumber: null, status: "IN_PROGRESS", packs: [],
  });
  assert.equal(report.metadata?.find((field) => field.label === "Confirmed at")?.value, "Not confirmed");
  assert.equal(report.metadata?.find((field) => field.label === "Supplier details")?.value, "Not recorded");
  assert.equal(report.metadata?.find((field) => field.label === "Shipment date")?.value, "Not recorded");
  assert.deepEqual(report.sections[0].rows, []);
  assert.equal(report.totals?.find((field) => field.label === "Total inventory cost")?.value, "$0.00");
});
