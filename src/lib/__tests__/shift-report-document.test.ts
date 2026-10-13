import assert from "node:assert/strict";
import test from "node:test";
import { createShiftReportDocument, shiftReportTimestamp, type ShiftReportData } from "../shift-report-document";

const shift: ShiftReportData = {
  id: "shift-1", terminalId: "T2", status: "CLOSED",
  openedAt: "2026-10-13T08:01:02.000Z", closedAt: "2026-10-13T16:03:04.000Z",
  openedBy: "Opening Operator", closedBy: "Closing Operator",
  grossSales: 15, cogs: 14.25, netMargin: 0.75, ticketsSold: 3,
  lines: [{ pack: "P1", game: "Game", display: "2", beginning: 10, ending: 7, ticketsSold: 3, sales: 15 }],
  audit: [{ pack: "P1", display: "2", direction: "LAST", beginning: 10, expected: 7, ending: 6, variance: -1 }],
  cash: { openingCash: 20, expectedCash: 35, countedCash: 34, cashVariance: -1,
    reconciledAt: "2026-10-13T16:03:04.000Z", reconciledBy: "Closing Operator" },
};

test("shift documents preserve identity, full timestamps, positions and signed variances", () => {
  const report = createShiftReportDocument(shift);
  assert.equal(report.metadata?.find((field) => field.label === "Shift ID")?.value, "shift-1");
  assert.equal(report.metadata?.find((field) => field.label === "Opened by")?.value, "Opening Operator");
  assert.equal(report.metadata?.find((field) => field.label === "Closed at")?.value, "2026-10-13 16:03:04.000 UTC");
  assert.deepEqual(report.sections[0].rows[0], ["2", "P1", "Game", 10, 7, 3, "$15.00"]);
  assert.equal(report.sections[1].rows[0][6], -1);
  assert.deepEqual(report.sections[2].rows.find((row) => row[0] === "Cash variance"), ["Cash variance", "-$1.00"]);
});

test("cash/card sales, returns and voids remain unavailable despite a drawer count", () => {
  const report = createShiftReportDocument(shift);
  for (const label of ["Cash sales", "Card sales", "Returns", "Voids"]) {
    assert.deepEqual(report.sections[2].rows.find((row) => row[0] === label), [label, "Not recorded"]);
  }
});

test("missing audit and cash data is explicit while recorded zero values are retained", () => {
  const report = createShiftReportDocument({
    ...shift, cash: null, audit: [],
    lines: [{ ...shift.lines[0], ending: 0, ticketsSold: 0, sales: 0 }],
  });
  assert.equal(report.sections[0].rows[0][4], 0);
  assert.equal(report.sections[0].rows[0][6], "$0.00");
  assert.ok(report.sections[1].rows[0].every((value) => value === "Not recorded"));
  assert.ok(report.sections[2].rows.every((row) => row[1] === "Not recorded"));
  assert.equal(shiftReportTimestamp(null), "Not recorded");
  assert.equal(shiftReportTimestamp("invalid"), "Not recorded");
});

test("active shift reports identify provisional movement rather than closing positions", () => {
  const report = createShiftReportDocument({ ...shift, status: "OPEN", closedAt: null, closedBy: "Not recorded" });
  assert.match(report.subtitle ?? "", /provisional/);
  assert.equal(report.sections[0].columns[4], "Current position");
  assert.equal(report.metadata?.find((field) => field.label === "Closed at")?.value, "Not recorded");
});
