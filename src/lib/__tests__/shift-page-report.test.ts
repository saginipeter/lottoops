import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("recent closed shift projection includes the ID used to load its report", () => {
  const pageSource = readFileSync("src/app/(dashboard)/shifts/page.tsx", "utf8");
  const clientSource = readFileSync("src/components/shifts/shift-pos.tsx", "utf8");
  const recentShiftQuery = pageSource.match(/const recentClosedShift[\s\S]*?select:\s*\{([\s\S]*?)\n\s*\},\n\s*\}\);/);
  assert.ok(recentShiftQuery, "recent closed-shift query should remain present");
  assert.match(recentShiftQuery[1] ?? "", /\bid:\s*true/);
  assert.match(clientSource, /loadShiftReportDocument\(recentClosedShift\.id\)/);
});
