import assert from "node:assert/strict";
import test from "node:test";
import { endOfReportDate, formatReportDate, formatReportInstantDate, formatReportTimestamp, reportDateKey, startOfReportDate } from "../report-timestamp";

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

test("shift report date uses the instant's Chicago calendar date without changing date-only formatting", () => {
  const close = "2026-11-15T02:30:00.000Z";
  assert.equal(reportDateKey(close), "2026-11-14");
  assert.equal(formatReportInstantDate(close), "Nov 14, 2026");
  assert.equal(formatReportTimestamp(close), "Nov 14, 2026, 8:30 PM");
  assert.equal(formatReportDate("2026-11-15"), "Nov 15, 2026");
});

test("Chicago close-date key follows daylight-saving offsets and rejects missing instants", () => {
  assert.equal(reportDateKey("2026-07-01T04:30:00.000Z"), "2026-06-30");
  assert.equal(formatReportInstantDate(null), "Not recorded");
  assert.equal(reportDateKey(null), null);
});

test("report-date filter boundaries use midnight in Chicago, including DST short and long days", () => {
  assert.equal(startOfReportDate("2026-11-14")?.toISOString(), "2026-11-14T06:00:00.000Z");
  assert.equal(endOfReportDate("2026-11-14")?.toISOString(), "2026-11-15T05:59:59.999Z");
  assert.equal(startOfReportDate("2026-03-08")?.toISOString(), "2026-03-08T06:00:00.000Z");
  assert.equal(endOfReportDate("2026-03-08")?.toISOString(), "2026-03-09T04:59:59.999Z");
  assert.equal(startOfReportDate("2026-11-01")?.toISOString(), "2026-11-01T05:00:00.000Z");
  assert.equal(endOfReportDate("2026-11-01")?.toISOString(), "2026-11-02T05:59:59.999Z");
  assert.equal(startOfReportDate("2026-02-30"), null);
});
