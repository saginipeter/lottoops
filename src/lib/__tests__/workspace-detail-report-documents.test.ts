import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAiDiscrepancyDocument, buildCorrectionDocument, buildDiscrepancyDocument,
  buildExceptionTrendsDocument, buildInventoryAgingDocument, buildLifecycleAnalyticsDocument,
  buildShipmentOverridesDocument, buildStateReportArchiveDocument, buildTicketReportsDocument,
  buildTicketReturnRequestsDocument, buildWhatsAppSummaryDocument,
} from "../workspace-detail-report-documents";
import { renderReportDocument, type ReportDocument } from "../report-document";

function assertTableWidths(document: ReportDocument) {
  for (const section of document.sections) {
    for (const row of section.rows) assert.equal(row.length, section.columns.length);
    if (section.totals) assert.equal(section.totals.length, section.columns.length);
  }
}

const agingPack = {
  serialNumber: "000123", game: "Cash", gameNumber: "004", status: "BACK_STOCK",
  display: null, receivedAt: "2026-09-01T12:00:00Z", activatedAt: null, ageDays: 43,
};

test("aging prints loaded packs oldest first without mutating input or guessing a display", () => {
  const packs = Object.freeze([Object.freeze({ ...agingPack, serialNumber: "000124", ageDays: 0 }), Object.freeze(agingPack)]);
  const document = buildInventoryAgingDocument(packs);
  assert.deepEqual(document.sections[0].rows[0], [
    "000123", "Cash", "004", "BACK STOCK", null, agingPack.receivedAt, null, 43,
  ]);
  assert.equal(document.sections[0].rows[1][7], 0);
  assert.equal(packs[0].serialNumber, "000124");
  assertTableWidths(document);
});

const discrepancy = {
  type: "AUDIT", status: "UNRESOLVED", game: "Cash", pack: "000123", display: "",
  expected: 0, observed: null, variance: -2, timestamp: null, actor: "", reason: "Review <ticket>",
};

test("discrepancy filter and rows are a single matching snapshot, retaining zeros and missing values", () => {
  const rows = [discrepancy, { ...discrepancy, status: "RESOLVED", resolvedBy: "Manager" }];
  for (const filter of ["ALL", "UNRESOLVED", "RESOLVED"] as const) {
    const document = buildDiscrepancyDocument(rows, filter);
    assert.equal(document.metadata?.[0].value, filter);
    assert.equal(document.sections[0].rows.length, filter === "ALL" ? 2 : 1);
    assert.equal(document.sections[0].rows[0][5], 0);
    assert.equal(document.sections[0].rows[0][6], null);
    assert.equal(document.sections[0].rows[0][4], null);
    if (filter !== "ALL") assert.equal(document.sections[0].rows[0][1], filter);
    assertTableWidths(document);
  }
});

test("correction history retains original and corrected strings, IDs, reasons and approvers", () => {
  const document = buildCorrectionDocument([{
    entityType: "PACK", entityId: "pack-1", fieldName: "ticket", oldValue: null,
    newValue: "000", reason: "Recounted", correctedByName: null, createdAt: "2026-10-14T12:00:00Z",
  }]);
  assert.deepEqual(document.sections[0].rows[0], [
    "2026-10-14T12:00:00Z", "PACK", "pack-1", "ticket", null, "000", "Recounted", null,
  ]);
  assertTableWidths(document);
});

const analytics = {
  summary: {
    averageReceiptToActivationDays: 0, averageActivationToCompletionDays: 2.5,
    backstockExposure: 100.25, activeExposure: 0, backstockOver30Days: 1,
    activeOver30Days: 0, reassignedPacks: 2,
  },
  games: [
    { game: "Cash", gameNumber: "001", packs: 2, tickets: 4, value: 20.5 },
    { game: "Gold", gameNumber: "002", packs: 1, tickets: 3, value: 7 },
  ],
};

test("lifecycle includes every provided summary metric and totals only loaded game rows", () => {
  const document = buildLifecycleAnalyticsDocument(analytics);
  assert.equal(document.sections[0].rows.length, 7);
  assert.deepEqual(document.sections[0].rows[0], ["Average receipt to activation (days)", 0]);
  assert.deepEqual(document.sections[0].rows[2], ["Backstock exposure (USD)", "$100.25"]);
  assert.deepEqual(document.sections[1].totals, ["Loaded game totals", null, 3, 7, "$27.50"]);
  assertTableWidths(document);
});

test("lifecycle totals do not invent a zero when a loaded metric is unavailable", () => {
  const document = buildLifecycleAnalyticsDocument({
    ...analytics, games: [{ ...analytics.games[0], tickets: undefined as unknown as number }],
  });
  assert.equal(document.sections[1].totals?.[3], null);
});

test("exception daily rows and summary remain distinct, including resolution counts and loaded since", () => {
  const document = buildExceptionTrendsDocument({
    since: "2026-09-14T12:00:00Z",
    summary: { auditVariances: 2, openSequenceLocks: 9, resolved: 1 },
    totals: [{ date: "2026-10-14", auditVariances: 2, sequenceLocks: 1, resolved: 1 }],
  });
  assert.equal(document.metadata?.find((item) => item.label === "Since")?.value, "2026-09-14T12:00:00Z");
  assert.deepEqual(document.sections[0].rows[1], ["Open sequence locks", 9]);
  assert.deepEqual(document.sections[1].rows[0], ["2026-10-14", 2, 1, 1]);
  assert.equal(document.sections[1].totals, undefined);
  assertTableWidths(document);
});

test("AI document uses only current risk, findings and recorded counts", () => {
  const analysis = Object.freeze({
    risk: "HIGH", findings: Object.freeze([{ type: "SEQUENCE_LOCKS", detail: "1 lock needs review." }]),
    counts: Object.freeze({ auditVariances: 0, sequenceLocks: 1, repeatActors: 0 }),
  });
  const document = buildAiDiscrepancyDocument(analysis);
  assert.equal(document.metadata?.[0].value, "HIGH");
  assert.deepEqual(document.sections[1].rows, [["SEQUENCE LOCKS", "1 lock needs review."]]);
  assert.deepEqual(document.sections[0].rows[0], ["Audit variances", 0]);
  assertTableWidths(document);
});

test("WhatsApp document preserves actual generated message instead of rebuilding metrics", () => {
  const summary = "Central daily summary\nShifts: 2\nSales: $0.00\nAudit variances: 0";
  const document = buildWhatsAppSummaryDocument(summary, "2026-10-14T12:00:00Z");
  assert.deepEqual(document.sections[0].rows, summary.split("\n").map((line) => [line]));
  assert.equal(document.metadata?.[0].value, "2026-10-14T12:00:00Z");
  assertTableWidths(document);
});

test("ticket report documents include all loaded records and full unparsed detail", () => {
  const reports = Array.from({ length: 10 }, (_, index) => ({
    id: `r-${index}`, storeId: "store-1", storeName: "Central",
    detail: "Unparsed report detail; ticket 0000123", performedByName: null, createdAt: "2026-10-14T12:00:00Z",
  }));
  const document = buildTicketReportsDocument(reports, "Scoped Ticket Reports");
  assert.equal(document.title, "Scoped Ticket Reports");
  assert.equal(document.sections[0].rows.length, 10);
  assert.equal(document.sections[0].rows[9][5], reports[9].detail);
  assert.equal(document.sections[0].rows[0][4], null);
  assertTableWidths(document);
});

test("return request document retains full shift/pack references, barcode and missing reason", () => {
  const document = buildTicketReturnRequestsDocument([{
    id: "request-1", storeId: "store-1", shiftId: "shift-full-id", packId: "pack-full-id",
    serialNumber: "000123", gameName: "Cash", gameNumber: "004", ticketBarcode: "00000009",
    reason: null, requestedByName: "Employee", createdAt: "2026-10-14T12:00:00Z",
  }]);
  assert.deepEqual(document.sections[0].rows[0], [
    "request-1", "store-1", "shift-full-id", "pack-full-id", "000123", "Cash", "004",
    "00000009", null, "Employee", "2026-10-14T12:00:00Z",
  ]);
  assertTableWidths(document);
});

test("shipment override document retains loaded evidence and missing approver", () => {
  const document = buildShipmentOverridesDocument([{
    id: 7, storeName: "Central", detail: "Override authorized after count",
    performedByName: null, createdAt: "2026-10-14T12:00:00Z",
  }]);
  assert.deepEqual(document.sections[0].rows[0], [
    7, "Central", "2026-10-14T12:00:00Z", null, "Override authorized after count",
  ]);
  assertTableWidths(document);
});

test("state archive is metadata-only, retains evidence reference, and never treats photo row placeholder as a metric", () => {
  const document = buildStateReportArchiveDocument({
    storeId: "store-1", reportType: "ACTIVATED", fileName: "receipt.jpg", rowCount: 0,
    uploadedAt: "2026-10-14T12:00:00Z", imageUrl: "https://example.invalid/evidence.jpg",
    verificationStatus: "OCR_PENDING",
  }, { storeName: "Central", weekStart: "2026-10-05", label: "Activated Report" });
  assert.equal(document.title, "Activated Report — Archive Record");
  assert.equal(document.metadata?.find((item) => item.label === "Week of Monday")?.value, "2026-10-05");
  assert.deepEqual(document.sections[0].rows[0], [
    "receipt.jpg", "2026-10-14T12:00:00Z", null, "OCR_PENDING", "https://example.invalid/evidence.jpg",
  ]);
  assert.equal(document.sections.length, 1);
  assertTableWidths(document);
});

test("state CSV archive preserves known row count without inventing an evidence link or metrics", () => {
  const document = buildStateReportArchiveDocument({
    storeId: "store-1", reportType: "INVENTORY", fileName: "inventory.csv", rowCount: 12,
    uploadedAt: "2026-10-14T12:00:00Z",
  }, { weekStart: "2026-10-05", label: "Inventory Report" });
  assert.equal(document.sections[0].rows[0][2], 12);
  assert.equal(document.sections[0].rows[0][3], null);
  assert.equal(document.sections[0].rows[0][4], null);
  assert.equal(document.metadata?.[0].value, null);
  assertTableWidths(document);
});

test("empty loaded collections produce valid documents without fabricated records", () => {
  const documents = [
    buildInventoryAgingDocument([]), buildCorrectionDocument([]), buildDiscrepancyDocument([], "ALL"),
    buildTicketReportsDocument([]), buildTicketReturnRequestsDocument([]), buildShipmentOverridesDocument([]),
  ];
  for (const document of documents) {
    assert.equal(document.sections[0].rows.length, 0);
    assert.match(renderReportDocument(document), /No records/);
    assertTableWidths(document);
  }
});

test("generated documents keep untrusted text data-only and render missing numeric values explicitly", () => {
  const document = buildDiscrepancyDocument([{ ...discrepancy, reason: '<script>alert("unsafe")</script>' }], "ALL");
  const html = renderReportDocument(document);
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(!html.includes("<script>"));
  assert.match(html, /Not recorded/);
  assert.match(html, /<td>0<\/td>/);
});
