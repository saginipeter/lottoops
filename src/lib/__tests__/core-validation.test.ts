import assert from "node:assert/strict";
import test from "node:test";
import { findUnassignedActivePacks, validateEndingTicket } from "@/lib/core-validation";

test("accepts ending ticket zero through beginning ticket", () => {
  assert.equal(validateEndingTicket(100, 0), null);
  assert.equal(validateEndingTicket(100, 100), null);
});

test("rejects an ending ticket beyond the beginning ticket", () => {
  assert.equal(validateEndingTicket(100, 101), "Ending ticket must be an integer from 0 through 100.");
});

test("rejects negative and non-integer ticket values", () => {
  assert.notEqual(validateEndingTicket(100, -1), null);
  assert.notEqual(validateEndingTicket(100, 1.5), null);
  assert.notEqual(validateEndingTicket(-1, 0), null);
});

test("finds active packs without display assignments", () => {
  assert.deepEqual(
    findUnassignedActivePacks([
      { serialNumber: "PACK-001", slot: { slotNumber: "01" } },
      { serialNumber: "PACK-002", slot: null },
      { serialNumber: "PACK-003", slot: null },
    ]),
    ["PACK-002", "PACK-003"]
  );
});