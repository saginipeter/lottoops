import assert from "node:assert/strict";
import test from "node:test";
import { compareDisplayNumberLabels, formatDisplayNumberLabel, sortByDisplayNumber } from "../display-number-order";

test("display labels sort by numeric sequence rather than lexicographic database order", () => {
  assert.deepEqual(["10", "2", "01", "1", "3"].sort(compareDisplayNumberLabels), ["01", "1", "2", "3", "10"]);
});

test("ticket tracking rows display in ascending numeric display order without mutating source rows", () => {
  const rows = [{ displayNumber: "10", id: "last" }, { displayNumber: "2", id: "middle" }, { displayNumber: "1", id: "first" }];
  const sorted = sortByDisplayNumber(rows, (row) => row.displayNumber);
  assert.deepEqual(sorted.map((row) => row.id), ["first", "middle", "last"]);
  assert.equal(rows[0]?.id, "last");
});

test("unassigned Backstock follows every assigned numeric and named display", () => {
  assert.deepEqual(["Back stock", "10", "A", "2", "", "Backstock"].sort(compareDisplayNumberLabels), ["2", "10", "A", "", "Back stock", "Backstock"]);
});

test("zero-padded display labels remain stable when their numeric values match", () => {
  assert.deepEqual(["01", "1", "001"].sort(compareDisplayNumberLabels), ["001", "01", "1"]);
});

test("display labels are not renumbered and empty assignments are explicit", () => {
  assert.equal(formatDisplayNumberLabel(" 01 "), "01");
  assert.equal(formatDisplayNumberLabel(""), "Backstock");
  assert.equal(formatDisplayNumberLabel(null), "Backstock");
});
