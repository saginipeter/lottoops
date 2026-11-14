import assert from "node:assert/strict";
import test from "node:test";
import { buildEndOfShiftReportDocument, buildShiftReportDocument, loadShiftReportDocument, type ShiftReportData } from "../shift-report";
import { readShiftRegisterSalesRecord, SHIFT_REPORT_REGISTER_SALES_QUERY } from "../shift-report-cash";
import { shiftReportWhere } from "../shift-report-query";

function fixture(): ShiftReportData {
  return {
    id: "shift-old", shiftNumber: 2, storeName: "Store", terminalId: "T2",
    openedAt: "2025-01-01T08:00:00Z", closedAt: "2025-01-01T16:00:00Z",
    openedBy: "Opener", closedBy: "Closer",
    grossSales: 60, ticketsSold: 12,
    gameBreakdown: [{ name: "Game", tickets: 12, sales: 60, cost: 57 }],
    packSales: [{ pack: "P1", game: "Game", display: "1", beginning: 50, ending: 38, tickets: 12, sales: 60 }],
    audit: [{ pack: "P1", display: "1", direction: "FIRST", beginningExpected: 1, beginning: 1, expected: 13, ending: 15 }],
    auditOpenedBy: "Auditor", auditClosedBy: "Closer",
    auditOpenedAt: "2025-01-01T08:05:00Z", auditClosedAt: "2025-01-01T15:59:00Z",
    registerScratchOffSales: 58, registerSalesRecordedAt: "2025-01-01T16:00:00Z", registerSalesRecordedBy: "Closer",
  };
}

test("shift template uses tracked ticket values, operators, and signed audit variance", () => {
  const document = buildShiftReportDocument(fixture());
  assert.equal(document.title, "Shift Ticket Tracking & Audit Report");
  assert.deepEqual(document.sections[0].totals, ["TOTAL SHIFT SUMMARY", "Not recorded", 12, "Not recorded", "$60.00", "$57.00"]);
  assert.deepEqual(document.sections[1].rows[0], ["1", "P1 / Game", 50, 38, 12, "$60.00"]);
  assert.deepEqual(document.sections.find((section) => section.title === "Physical Ticket Audit")?.rows[0], ["1 / P1", "FIRST", 1, 1, 13, 15, 2]);
  assert.equal(document.metadata?.find((field) => field.label === "Shift")?.value, "Shift 2");
  assert.equal(document.metadata?.find((field) => field.label === "Shift")?.value, "Shift 2");
  assert.doesNotMatch(JSON.stringify(document), /shift-old/);
  assert.equal(document.metadata?.find((field) => field.label === "Opening audit operator")?.value, "Auditor");
  assert.equal(document.metadata?.find((field) => field.label === "Closed")?.value, "Jan 1, 2025, 10:00 AM");
  assert.equal(document.metadata?.find((field) => field.label === "Opened")?.value, "Jan 1, 2025, 2:00 AM");
  assert.equal(document.metadata?.find((field) => field.label === "Opening audit time")?.value, "Jan 1, 2025, 2:05 AM");
  const registerSection = document.sections.find((section) => section.title === "Register Scratch Off Sales")!;
  assert.deepEqual(registerSection.rows.slice(0, 3), [
    ["System tracked ticket value", "$60.00"],
    ["Register Scratch Off Sales", "$58.00"],
    ["Difference (register minus system)", "-$2.00"],
  ]);
  assert.equal(registerSection.rows.at(-1)?.[1], "Jan 1, 2025, 10:00 AM");
  assert.doesNotMatch(JSON.stringify(document), /opening drawer cash|counted closing cash|cash variance/i);
});

test("financial summaries show bidirectional shift quantities and the 100/95 split", () => {
  const shift = fixture();
  shift.grossSales = 250;
  shift.ticketsSold = 50;
  shift.gameBreakdown = [
    { id: "lucky", name: "Lucky 7s (Rev. 150-1)", totalTickets: 150, tickets: 10, activeStock: 140, sales: 50, cost: 47.5 },
    { id: "mega", name: "Mega Cash (Asc. 1-200)", totalTickets: 200, tickets: 25, activeStock: 175, sales: 125, cost: 118.75 },
    { id: "wild", name: "Super Wild (Rev. 100-1)", totalTickets: 100, tickets: 15, activeStock: 85, sales: 75, cost: 71.25 },
  ];
  for (const build of [buildShiftReportDocument, buildEndOfShiftReportDocument]) {
    const summary = build(shift).sections.find((section) => section.title === "Ticket Tracking Summary")!;
    assert.deepEqual(summary.columns, ["Game / Game #", "Total Tickets", "Tickets Tracked", "Active Stock", "Ticket Value (100%)", "Cost / Payout (95%)"]);
    assert.deepEqual(summary.rows[0], ["Lucky 7s (Rev. 150-1)", 150, 10, 140, "$50.00", "$47.50"]);
    assert.deepEqual(summary.totals, ["TOTAL SHIFT SUMMARY", 450, 50, 400, "$250.00", "$237.50"]);
  }
});

test("financial summaries preserve zero stock and unknown closing inventory", () => {
  const shift = fixture();
  Object.assign(shift.gameBreakdown[0], { totalTickets: 12, activeStock: 0 });
  assert.equal(buildShiftReportDocument(shift).sections[0].rows[0][3], 0);
  shift.gameBreakdown[0].activeStock = null;
  assert.equal(buildShiftReportDocument(shift).sections[0].totals?.[3], "Not recorded");
});

test("financial summary totals use 95% of shift gross before currency rounding", () => {
  const shift = fixture();
  shift.grossSales = 1;
  shift.gameBreakdown = [
    { name: "A", tickets: 1, sales: 0.5, cost: 0.48 },
    { name: "B", tickets: 1, sales: 0.5, cost: 0.48 },
  ];
  assert.equal(buildShiftReportDocument(shift).sections[0].totals?.[5], "$0.95");
});

test("audit report separates inventory balances from physical ticket IDs", () => {
  const shift = fixture();
  Object.assign(shift.audit[0], {
    beginningTickets: 150, salesTickets: 10, expectedEndingTickets: 140, endingTickets: 140,
  });
  const document = buildShiftReportDocument(shift);
  assert.deepEqual(document.sections.find((section) => section.title === "Physical Audit Inventory Counts")?.rows, [
    ["1 / P1", 150, 10, 140, 140],
  ]);
});

test("register report preserves its captured scratch-off sales total and compares it with system tracking", () => {
  const shift = fixture();
  shift.registerScratchOffSales = 125;
  const document = buildShiftReportDocument(shift);
  assert.deepEqual(document.sections.find((section) => section.title === "Register Scratch Off Sales")?.rows.slice(0, 3), [
    ["System tracked ticket value", "$60.00"],
    ["Register Scratch Off Sales", "$125.00"],
    ["Difference (register minus system)", "$65.00"],
  ]);
});

test("missing register and physical audit data remain Not recorded, not zero", () => {
  const shift = fixture();
  shift.registerScratchOffSales = readShiftRegisterSalesRecord(undefined).registerScratchOffSales;
  shift.audit[0].ending = null;
  shift.packSales[0].ending = null;
  shift.packSales[0].sales = null;
  const document = buildShiftReportDocument(shift);
  const registerRows = document.sections.find((section) => section.title === "Register Scratch Off Sales")!.rows;
  assert.equal(registerRows[1][1], "Not recorded");
  assert.equal(registerRows[2][1], "Not recorded");
  assert.equal(document.sections.find((section) => section.title === "Physical Ticket Audit")?.rows[0][6], "Not recorded");
  assert.equal(document.sections.find((section) => section.title === "Ticket Tracking by Display")?.rows[0][3], "Not recorded");
  assert.equal(document.sections.find((section) => section.title === "Ticket Tracking by Display")?.rows[0][5], "Not recorded");
});

test("employee login sales are printed by employee, terminal, shift and sale-time display", () => {
  const shift = fixture();
  shift.operatorSessions = [{
    shiftId: "shift-old", sessionId: "login-session-12345678", employeeId: "cashier-1", employeeName: "Cashier One", terminalId: "T2",
    signedInAt: "2025-01-01T09:00:00Z", endedAt: "2025-01-01T12:00:00Z", legacyAttribution: false,
    tickets: 3, grossSales: 6, hasEstimatedPrice: false,
    packs: [{ packId: "pack-1", pack: "P1", game: "Game", display: "2", tickets: 3, grossSales: 6, firstSaleAt: "2025-01-01T09:15:00Z", lastSaleAt: "2025-01-01T10:10:00Z", hasEstimatedPrice: false }],
  }];
  const document = buildEndOfShiftReportDocument(shift);
  const login = document.sections.find((section) => section.title === "Ticket Tracking by Employee Login & Terminal");
  const pack = document.sections.find((section) => section.title === "Employee & Terminal Pack Tracking");
  assert.deepEqual(login?.rows[0]?.slice(0, 3), ["Cashier One", "T2", "Shift 2"]);
  assert.deepEqual(login?.rows[0]?.slice(3, 5), ["Jan 1, 2025, 3:00 AM", "Jan 1, 2025, 6:00 AM"]);
  assert.deepEqual(pack?.rows[0]?.slice(6, 8), ["Jan 1, 2025, 3:15 AM", "Jan 1, 2025, 4:10 AM"]);
  assert.doesNotMatch(JSON.stringify(document), /login-session-12345678|shift-old/);
  assert.equal(login?.rows[0]?.[5], 3);
  assert.equal(login?.rows[0]?.[6], "$6.00");
  assert.deepEqual(pack?.rows[0]?.slice(0, 4), ["Cashier One", "T2", "2", "P1 / Game"]);
});

test("staff printable report mode excludes shared shift, register, and audit data", () => {
  const shift = fixture();
  shift.operatorSessionsOnly = true;
  shift.operatorSessions = [{
    shiftId: "shift-old", sessionId: "login-session-12345678", employeeId: "cashier-1", employeeName: "Cashier One", terminalId: "T2",
    signedInAt: "2025-01-01T09:00:00Z", endedAt: null, legacyAttribution: false,
    tickets: 1, grossSales: 2, hasEstimatedPrice: false, packs: [],
  }];
  for (const build of [buildShiftReportDocument, buildEndOfShiftReportDocument]) {
    const document = build(shift);
    assert.equal(document.title, "Employee Login Ticket Tracking Report");
    assert.deepEqual(document.sections.map((section) => section.title), ["Ticket Tracking by Employee Login & Terminal", "Employee & Terminal Pack Tracking"]);
    assert.match(document.notes?.[0] ?? "", /does not include other employees' tracked tickets/i);
  }
});

test("safe register-sales extraction preserves zero and never selects historical drawer cash", () => {
  assert.deepEqual(readShiftRegisterSalesRecord({
    registerScratchOffSales: "0.00", registerSalesRecordedAt: "2025-01-01T16:00:00Z", registerSalesRecordedBy: "Cashier",
  }), {
    registerScratchOffSales: 0,
    registerSalesRecordedAt: "2025-01-01T16:00:00Z",
    registerSalesRecordedBy: "Cashier",
  });
  assert.equal(readShiftRegisterSalesRecord({ registerScratchOffSales: "invalid" }).registerScratchOffSales, null);
  assert.match(SHIFT_REPORT_REGISTER_SALES_QUERY, /to_jsonb\(s\)->>'registerScratchOffSales'/);
  assert.match(SHIFT_REPORT_REGISTER_SALES_QUERY, /to_jsonb\(s\)->>'registerScratchOffSalesRecordedAt'/);
  assert.match(SHIFT_REPORT_REGISTER_SALES_QUERY, /s\."storeId" = \$1 AND s\.id = ANY\(\$2::text\[\]\)/);
  assert.doesNotMatch(SHIFT_REPORT_REGISTER_SALES_QUERY, /openingCash|expectedCash|countedCash|cashVariance|cashReconciled|ALTER TABLE/i);
});

test("employee shift report query is scoped to their selected shift", () => {
  const where = shiftReportWhere("store-1", "shift-1", new Date("2025-01-01T00:00:00Z"), new Date("2025-01-02T00:00:00Z"));
  assert.deepEqual(where, { storeId: "store-1", status: "CLOSED", id: "shift-1" });
});

test("simple end-of-shift report shows selected shift statistics and signed variances", () => {
  const document = buildEndOfShiftReportDocument(fixture());
  assert.equal(document.title, "End of Shift Report");
  assert.equal(document.metadata?.find((field) => field.label === "Report date")?.value, "Jan 1, 2025");
  assert.deepEqual(document.sections[0].rows, [["Tickets tracked", 12], ["Value of tracked tickets", "$60.00"]]);
  assert.deepEqual(document.sections.find((section) => section.title === "Register Scratch Off Sales")?.rows.slice(0, 3), [["System tracked ticket value", "$60.00"], ["Register Scratch Off Sales", "$58.00"], ["Difference (register minus system)", "-$2.00"]]);
  assert.deepEqual(document.sections[2].rows[0], ["1", "P1", "Game", 50, 38, 12, "$60.00", "$57.00"]);
  assert.deepEqual(document.sections[3].rows, [["1 / P1", 13, 15, 2]]);
  assert.match(document.notes![0], /selected shift only/);
});

test("simple report omits matching packs but preserves incomplete counts and zero totals", () => {
  const shift = fixture();
  shift.grossSales = 0;
  shift.ticketsSold = 0;
  shift.registerScratchOffSales = 0;
  shift.packSales[0].ending = 0;
  shift.audit[0].ending = shift.audit[0].expected;
  let document = buildEndOfShiftReportDocument(shift);
  assert.deepEqual(document.sections[3].rows, []);
  assert.match(document.notes![1], /1 of 1 audited packs match/);
  assert.deepEqual(document.sections[0].rows[1], ["Value of tracked tickets", "$0.00"]);
  assert.equal(document.sections.find((section) => section.title === "Register Scratch Off Sales")?.rows[2][1], "$0.00");
  shift.audit[0].ending = null;
  shift.packSales[0].ending = null;
  shift.registerScratchOffSales = null;
  document = buildEndOfShiftReportDocument(shift);
  assert.deepEqual(document.sections[3].rows, [["1 / P1", 13, null, null]]);
  assert.equal(document.sections.find((section) => section.title === "Register Scratch Off Sales")?.rows[1][1], "Not recorded");
});

test("simple report does not claim a clean audit when no audit exists", () => {
  const shift = fixture();
  shift.audit = [];
  shift.packSales = [];
  const document = buildEndOfShiftReportDocument(shift);
  assert.equal(document.notes![1], "No physical ticket audit recorded.");
  assert.equal(document.sections[0].rows.length, 2);
});

test("exact shift query omits date restrictions while retaining store and closed scopes", () => {
  const from = new Date("2026-01-01");
  const to = new Date("2026-02-01");
  assert.deepEqual(shiftReportWhere("authorized-store", "shift-old", from, to), { storeId: "authorized-store", status: "CLOSED", id: "shift-old" });
  assert.deepEqual(shiftReportWhere("authorized-store", null, from, to), { storeId: "authorized-store", status: "CLOSED", closedAt: { gte: from, lte: to } });
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
  assert.equal(document.metadata?.find((field) => field.label === "Shift")?.value, "Shift 2");
  assert.doesNotMatch(JSON.stringify(document), /shift & old/);
  assert.equal(fetchMock.mock.callCount(), 1);
});

test("lazy loader rejects failed, inaccessible, or missing closed shift reports", async (context) => {
  const fetchMock = context.mock.method(globalThis, "fetch", async () => new Response(null, { status: 404 }));
  await assert.rejects(loadShiftReportDocument("missing"), /Unable to load/);
  fetchMock.mock.mockImplementation(async () => Response.json({ shifts: [fixture()] }));
  await assert.rejects(loadShiftReportDocument("other-store-id"), /not found/);
});

test("printed pack and audit tables use natural Display # order without renumbering labels", () => {
  const shift = fixture();
  shift.packSales = [
    { pack: "P10", game: "Game", display: "10", beginning: 50, ending: 40, tickets: 10, sales: 50 },
    { pack: "P2", game: "Game", display: "2", beginning: 50, ending: 45, tickets: 5, sales: 25 },
    { pack: "P01", game: "Game", display: "01", beginning: 50, ending: 48, tickets: 2, sales: 10 },
    { pack: "Backstock", game: "Game", display: "", beginning: 50, ending: null, tickets: null, sales: null },
  ];
  shift.audit = [
    { pack: "P10", display: "10", direction: "FIRST", beginningExpected: 1, beginning: 1, expected: 11, ending: 12 },
    { pack: "P2", display: "2", direction: "FIRST", beginningExpected: 1, beginning: 1, expected: 6, ending: 7 },
    { pack: "P01", display: "01", direction: "FIRST", beginningExpected: 1, beginning: 1, expected: 3, ending: 4 },
  ];
  const full = buildShiftReportDocument(shift);
  assert.equal(full.sections[1].columns[0], "Display #");
  assert.equal(full.sections[4].columns[0], "Display # / Pack");
  assert.deepEqual(full.sections[1].rows.map((row) => row[0]), ["01", "2", "10", ""]);
  assert.deepEqual(full.sections[4].rows.map((row) => row[0]), ["01 / P01", "2 / P2", "10 / P10"]);
  assert.deepEqual(full.sections[3].rows.map((row) => row[0]), ["01 / P01", "2 / P2", "10 / P10"]);
  const closing = buildEndOfShiftReportDocument(shift);
  assert.equal(closing.sections[2].columns[0], "Display #");
  assert.deepEqual(closing.sections[2].rows.map((row) => row[0]), ["01", "2", "10", "Backstock"]);
  assert.equal(closing.sections[3].columns[0], "Display # / Pack");
  assert.deepEqual(closing.sections[3].rows.map((row) => row[0]), ["01 / P01", "2 / P2", "10 / P10"]);
});
