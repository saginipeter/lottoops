import assert from "node:assert/strict";
import { test } from "node:test";
import { formatShiftLabel, getNextAvailableShiftNumber, parseShiftNumber } from "../shift-number";

test("parses only explicit shift numbers 1 through 3", () => {
  assert.equal(parseShiftNumber(1), 1);
  assert.equal(parseShiftNumber("2"), 2);
  assert.equal(parseShiftNumber(" 3 "), 3);
  for (const value of [0, 4, -1, "1.5", "", "A", null, undefined]) {
    assert.equal(parseShiftNumber(value), null);
  }
});

test("returns the first unused numbered shift without generating letter labels", () => {
  assert.equal(getNextAvailableShiftNumber([]), 1);
  assert.equal(getNextAvailableShiftNumber([1]), 2);
  assert.equal(getNextAvailableShiftNumber([1, 3]), 2);
  assert.equal(getNextAvailableShiftNumber([1, 2, 3]), null);
  assert.equal(formatShiftLabel(2), "Shift 2");
  assert.equal(formatShiftLabel(null), "Unnumbered shift");
});
