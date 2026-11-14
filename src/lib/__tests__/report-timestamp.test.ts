import assert from "node:assert/strict";
import test from "node:test";
import { formatReportDate, formatReportTimestamp } from "../report-timestamp";

test("report timestamps default to concise Chicago 12-hour time without seconds or timezone suffix", () => {
  assert.equal(formatReportTimestamp("2026-11-14T18:07:59.000Z"), "Nov 14, 2026, 12:07 PM");
  assert.equal(formatReportTimestamp("2026-11-14T06:07:59.000Z"), "Nov 14, 2026, 12:07 AM");
  assert.doesNotMatch(formatReportTimestamp("2026-11-14T18:07:59.000Z"), /:59|UTC|GMT|T18:/);
});

test("report timestamp accepts Date values and an explicit store timezone", () => {
  assert.equal(formatReportTimestamp(new Date("2026-11-14T18:07:00.000Z"), "America/New_York"), "Nov 14, 2026, 1:07 PM");
  assert.equal(formatReportTimestamp("2026-11-14T18:07:00.000Z", "not/a-timezone"), "Nov 14, 2026, 12:07 PM");
});

test("invalid or missing report timestamps return a safe placeholder", () => {
  for (const value of [null, undefined, "", "not-a-date", 42, Number.NaN]) {
    assert.equal(formatReportTimestamp(value), "Not recorded");
  }
});

test("report date formatter keeps ISO calendar dates stable across timezones", () => {
  assert.equal(formatReportDate("2026-01-01"), "Jan 1, 2026");
  assert.equal(formatReportDate("2026-01-01T00:00:00.000Z"), "Jan 1, 2026");
  assert.equal(formatReportDate("bad"), "Not recorded");
});
