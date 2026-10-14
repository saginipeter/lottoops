import assert from "node:assert/strict";
import test from "node:test";
import { buildEndOfShiftReportDocument, buildShiftReportDocument, loadShiftReportDocument, type ShiftReportData } from "../shift-report";
import { readShiftCashRecord, SHIFT_REPORT_CASH_QUERY } from "../shift-report-cash";
import { shiftReportWhere } from "../shift-report-query";

function fixture(): ShiftReportData {
  return {
    id: "shift-old", storeName: "Store", terminalId: "T2",
    openedAt: "2025-01-01T08:00:00Z", closedAt: "2025-01-01T16:00:00Z",
    openedBy: "Opener", closedBy: "Closer",
    grossSales: 60, ticketsSold: 12,
    gameBreakdown: [{ name: "Game", tickets: 12, sales: 60, cost: 57 }],
    packSales: [{ pack: "P1", game: "Game", display: "1", beginning: 50, ending: 38, tickets: 12, sales: 60 }],
    audit: [{ pack: "P1", display: "1", direction: "FIRST", beginningExpected: 1, beginning: 1, expected: 13, ending: 15 }],
    auditOpenedBy: "Auditor", auditClosedBy: "Closer",
    auditOpenedAt: "2025-01-01T08:05:00Z", auditClosedAt: "2025-01-01T15:59:00Z",
    cash: { openingCash: 100, expectedCash: 160, countedCash: 155, cashVariance: -5, reconciledAt: "2025-01-01T16:00:00Z", reconciledBy: "Closer" },
  };
}

test("shift template uses finalized sales, counts, operators, and signed audit variance", () => {
  const document = buildShiftReportDocument(fixture());
  assert.deepEqual(document.sections[0].totals, ["Total", 12, "$60.00", "$57.00"]);
  assert.deepEqual(document.sections[1].rows[0], ["1", "P1 / Game", 50, 38, 12, "$60.00"]);
  assert.deepEqual(document.sections[4].rows[0], ["1 / P1", "FIRST", 1, 1, 13, 15, 2]);
  assert.equal(document.metadata?.find((field) => field.label === "Shift ID")?.value, "shift-old");
  assert.equal(document.metadata?.find((field) => field.label === "Opening audit operator")?.value, "Auditor");
  assert.equal(document.metadata?.find((field) => field.label === "Closed")?.value, "2025-01-01 16:00:00 UTC");
});

test("cash report preserves recorded values without deriving cash sales or reconciling again", () => {
  const shift = fixture();
  shift.cash.expectedCash = 125;
  shift.cash.cashVariance = 30;
  const document = buildShiftReportDocument(shift);
  assert.deepEqual(document.sections[2].rows, [
    ["Cash sales", "Not recorded"], ["Card sales", "Not recorded"], ["Returns", "Not recorded"], ["Voids", "Not recorded"],
  ]);
  assert.deepEqual(document.sections[3].rows.slice(0, 4), [
    ["Opening drawer cash", "$100.00"], ["Recorded expected cash", "$125.00"],
    ["Counted closing cash", "$155.00"], ["Recorded cash variance", "$30.00"],
  ]);
});

test("missing cash and physical audit data remain Not recorded, not zero", () => {
  const shift = fixture();
  shift.cash = readShiftCashRecord(undefined).cash;
  shift.audit[0].ending = null;
  shift.packSales[0].ending = null;
  shift.packSales[0].sales = null;
  const document = buildShiftReportDocument(shift);
  assert.ok(document.sections[3].rows.every((row) => row[1] === "Not recorded"));
  assert.equal(document.sections[4].rows[0][6], "Not recorded");
  assert.equal(document.sections[1].rows[0][3], "Not recorded");
  assert.equal(document.sections[1].rows[0][5], "Not recorded");
});

test("safe cash extraction preserves zeros and negative variance and tolerates absent columns", () => {
  assert.deepEqual(readShiftCashRecord({
    terminalId: "T4", openingCash: "0.00", expectedCash: null, countedCash: "0",
    cashVariance: "-2.50", cashReconciledBy: "Cashier",
  }), {
    terminalId: "T4",
    cash: { openingCash: 0, expectedCash: null, countedCash: 0, cashVariance: -2.5, reconciledAt: null, reconciledBy: "Cashier" },
  });

  assert.equal(readShiftCashRecord({ openingCash: "invalid" }).cash.openingCash, null);
  assert.match(SHIFT_REPORT_CASH_QUERY, /to_jsonb\(s\)->>'openingCash'/);
  assert.match(SHIFT_REPORT_CASH_QUERY, /s\."storeId" = \$1 AND s\.id = ANY\(\$2::text\[\]\)/);
  assert.doesNotMatch(SHIFT_REPORT_CASH_QUERY, /ALTER TABLE/);
});

test("simple end-of-shift report shows selected shift statistics and signed variances", () => {
    const document = buildEndOfShiftReportDocument(fixture());
    assert.equal(document.title, "End of Shift Report");
    assert.equal(document.metadata?.find((field) => field.label === "Report date (UTC)")?.value, "2025-01-01");
    assert.deepEqual(document.sections[0].rows, [
      ["Tickets sold", 12], ["Total sales", "$60.00"],
      ["Opening remaining tickets", 50], ["Closing remaining tickets", 38],
    ]);
    assert.deepEqual(document.sections[1].rows.at(-1), ["Recorded cash variance", "-$5.00"]);
    assert.deepEqual(document.sections[2].rows, [["1 / P1", 13, 15, 2]]);
    assert.match(document.notes![0], /selected shift only/);
  });

  test("simple report omits matching packs but preserves incomplete counts and zero totals", () => {
    const shift = fixture();
    shift.grossSales = 0;
    shift.ticketsSold = 0;
    shift.cash = readShiftCashRecord({ cashVariance: 0 }).cash;
    shift.packSales[0].ending = 0;
    shift.audit[0].ending = shift.audit[0].expected;
    let document = buildEndOfShiftReportDocument(shift);
    assert.deepEqual(document.sections[2].rows, []);
    assert.match(document.notes![1], /1 of 1 audited packs match/);
    assert.deepEqual(document.sections[0].rows[1], ["Total sales", "$0.00"]);
    assert.deepEqual(document.sections[0].rows[3], ["Closing remaining tickets", 0]);
    assert.deepEqual(document.sections[1].rows.at(-1), ["Recorded cash variance", "$0.00"]);
    shift.audit[0].ending = null;
    shift.packSales[0].ending = null;
    document = buildEndOfShiftReportDocument(shift);
    assert.deepEqual(document.sections[2].rows, [["1 / P1", 13, null, null]]);
    assert.deepEqual(document.sections[0].rows[3], ["Closing remaining tickets", null]);
  });

  test("simple report does not claim a clean audit when no audit exists", () => {
    const shift = fixture();
    shift.audit = [];
    shift.packSales = [];
    const document = buildEndOfShiftReportDocument(shift);
    assert.equal(document.notes![1], "No physical ticket audit recorded.");
    assert.equal(document.sections[0].rows[2][1], null);
  });
test("exact shift query omits date restrictions while retaining store and closed scopes", () => {
  const from = new Date("2026-01-01");
  const to = new Date("2026-02-01");
  assert.deepEqual(shiftReportWhere("authorized-store", "shift-old", from, to), {
    storeId: "authorized-store", status: "CLOSED", id: "shift-old",
  });
  assert.deepEqual(shiftReportWhere("authorized-store", null, from, to), {
    storeId: "authorized-store", status: "CLOSED", closedAt: { gte: from, lte: to },
  });
});

test("scoped lazy loader encodes the ID and builds only the requested shift", async (context) => {
  const shift = fixture();
  shift.id = "shift & old";
  const fetchMock = context.mock.method(globalThis, "fetch", async (url: string | URL | Request, init?: RequestInit) => {
    assert.equal(url, "/api/reports/shifts?shiftId=shift%20%26%20old");
    assert.deepEqual(init, { cache: "no-store" });
    return Response.json({ shifts: [shift] });
  });
  const document = await loadShiftReportDocument(shift.id);
  assert.equal(document.metadata?.[0].value, shift.id);
  assert.equal(fetchMock.mock.callCount(), 1);
});

test("lazy loader rejects failed, inaccessible, or missing closed shift reports", async (context) => {
  const fetchMock = context.mock.method(globalThis, "fetch", async () => new Response(null, { status: 404 }));
  await assert.rejects(loadShiftReportDocument("missing"), /Unable to load/);
  fetchMock.mock.mockImplementation(async () => Response.json({ shifts: [fixture()] }));
  await assert.rejects(loadShiftReportDocument("other-store-id"), /not found/);
});
