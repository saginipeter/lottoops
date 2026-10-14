import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  createActivityReportDocument,
  createInventoryStatusReportDocument,
  summarizeActivity,
  type ActivityRow,
  type InventoryReportRow,
} from "@/lib/activity-inventory-report-documents";
import { renderReportDocument } from "@/lib/report-document";

const activity: ActivityRow[] = [
  { id: 1, action: "SHIFT_OPEN", entityType: "Shift", entityId: "shift-1", detail: "Opened morning shift", performedById: "user-1", performedByName: "Sam", terminalId: "Register 1", createdAt: "2026-10-14T08:00:00Z" },
  { id: 2, action: "SEQUENCE_LOCK_RESOLVED", entityType: "Pack", entityId: "pack-1", detail: "Manager confirmed physical ticket <21>", performedById: "user-2", performedByName: null, terminalId: null, createdAt: "2026-10-14T09:00:00Z" },
];

const packs: InventoryReportRow[] = [
  { id: "pack-1", status: "ACTIVE", serialNumber: "000123", game: { name: "Lucky Game" }, gameNumber: "0042", packNumber: "0007", slot: { slotNumber: "01" }, ticketQuantity: 10, retailValue: "50.50", activeRemovalReason: "Manager review", removalReason: "Old reason" },
  { id: "pack-2", status: "ACTIVE", serialNumber: "000124", game: { name: "Second Game" }, ticketQuantity: null, retailValue: 25 },
];

test("activity document uses the displayed filtered rows for totals and includes collapsed details", () => {
  const filtered = activity.filter((row) => row.action === "SEQUENCE_LOCK_RESOLVED");
  const report = createActivityReportDocument(filtered, { from: "2026-10-01", to: "2026-10-14", action: "SEQUENCE_LOCK_RESOLVED" });
  assert.equal(report.title, "Activity Report");
  assert.equal(report.paper, "A4");
  assert.deepEqual(report.metadata, [
    { label: "From", value: "2026-10-01" },
    { label: "To", value: "2026-10-14" },
    { label: "Action", value: "Sequence issue resolved" },
  ]);
  assert.deepEqual(report.sections[0].rows, [[1, 1, 0, 1, 1]]);
  assert.deepEqual(report.sections[1].rows[0].slice(1), [
    "Sequence issue resolved", "user-2", "—", "Needs review",
    "Manager confirmed physical ticket <21>", "2 · SEQUENCE_LOCK_RESOLVED · Pack · pack-1",
  ]);
  assert.equal(report.sections[1].totals?.[1], filtered.length);
  assert.equal(report.sections[1].rows.length, filtered.length);
});

test("activity summary and data template agree for all events", () => {
  assert.deepEqual(summarizeActivity(activity), { total: 2, people: 2, terminals: 1, corrections: 1, exceptions: 1 });
  const report = createActivityReportDocument(activity, { from: "2026-10-01", to: "2026-10-14", action: "ALL" });
  assert.equal(report.metadata?.[2].value, "All activity");
  assert.deepEqual(report.sections[0].rows, [[2, 2, 1, 1, 1]]);
  assert.equal(report.sections[1].rows[0][4], "Recorded");
});

test("inventory document preserves identifiers, counts, filter labels, quantities and retail totals", () => {
  const report = createInventoryStatusReportDocument(packs, { ACTIVE: 2 }, { status: "ACTIVE", q: " Lucky " });
  assert.deepEqual(report.metadata, [
    { label: "Status", value: "ACTIVE" },
    { label: "Search", value: "Lucky" },
    { label: "Filtered packs", value: 2 },
    { label: "Filtered retail value", value: "$75.50" },
  ]);
  assert.deepEqual(report.sections[0].rows, [["ACTIVE", 2]]);
  assert.deepEqual(report.sections[0].totals, ["Total packs", 2]);
  assert.deepEqual(report.sections[1].rows, [
    ["ACTIVE", "Lucky Game #0042", "01", "0007", "000123", 10, "$50.50", "Manager review"],
    ["ACTIVE", "Second Game #—", "—", "—", "000124", 0, "$25.00", "—"],
  ]);
  assert.deepEqual(report.sections[1].totals, ["Total", "", "", "", "", 10, "$75.50", ""]);
  assert.match(report.notes?.[0] ?? "", /up to 1,000 packs/);
});

test("inventory report uses removal reason when active reason is missing", () => {
  const report = createInventoryStatusReportDocument([{ ...packs[1], removalReason: "Returned to vendor" }], { RETURNED: 1 }, { status: "RETURNED", q: "" });
  assert.equal(report.sections[1].rows[0][7], "Returned to vendor");
  assert.equal(report.metadata?.[1].value, "All packs");
});

test("empty filtered documents retain metadata and zero totals", () => {
  const activityReport = createActivityReportDocument([], { from: "2026-10-01", to: "2026-10-14", action: "ALL" });
  assert.deepEqual(activityReport.sections[0].rows, [[0, 0, 0, 0, 0]]);
  assert.deepEqual(activityReport.sections[1].rows, []);
  const inventoryReport = createInventoryStatusReportDocument([], {}, { status: "BACK_STOCK", q: "Missing" });
  assert.equal(inventoryReport.metadata?.[0].value, "BACK STOCK");
  assert.deepEqual(inventoryReport.sections[1].rows, []);
  assert.deepEqual(inventoryReport.sections[1].totals, ["Total", "", "", "", "", 0, "$0.00", ""]);
});

test("report output contains only escaped data and identical repeatable view/print content", () => {
  const report = createActivityReportDocument(activity, { from: "2026-10-01", to: "2026-10-14", action: "ALL" });
  const view = renderReportDocument(report);
  assert.equal(view, renderReportDocument(report));
  assert.match(view, /Manager confirmed physical ticket &lt;21&gt;/);
  assert.doesNotMatch(view, /<button|<select|<input|View details|Export CSV/);
});

test("workspace has no screen-print fallback or dashboard preview modal", () => {
  const source = readFileSync(new URL("../../components/reports/reports-workspace.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /window\.print|report-printing|previewOpen|aria-modal|report-workspace-print-target/);
  assert.match(source, /data-only documents/);
  assert.match(source, /\{renderReport\(\)\}/);
});

test("activity and inventory actions are snapshot-guarded and cancel obsolete requests", () => {
  for (const filename of ["activity-report.tsx", "inventory-status-report.tsx"]) {
    const source = readFileSync(new URL(`../../components/reports/${filename}`, import.meta.url), "utf8");
    assert.match(source, /<ReportActions document=\{reportDocument\} disabled=\{loading \|\| !!error\}/);
    assert.match(source, /const currentSnapshot = snapshot\?/);
    assert.match(source, /const rows = currentSnapshot\?\.rows \?\? EMPTY_ROWS/);
    assert.match(source, /setSnapshot\(null\)/);
    assert.match(source, /if \(!?active\)/);
    assert.match(source, /controller\.abort\(\)/);
    assert.doesNotMatch(source, /window\.print|report-printing/);
  }
});
