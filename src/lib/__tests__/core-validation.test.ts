import assert from "node:assert/strict";
import test from "node:test";
import { expectedPhysicalTicket, findUnassignedActivePacks, physicalTicketFromRemaining, remainingTicketsFromStartingTicket, validateEndingTicket } from "@/lib/core-validation";

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

test("maps a 50-ticket pack starting at ticket 1 to 50 remaining tickets", () => {
  assert.equal(remainingTicketsFromStartingTicket(1, 50), 50);
  assert.equal(expectedPhysicalTicket(1, 50, 50), 1);
  assert.equal(expectedPhysicalTicket(1, 50, 49), 2);
});

test("maps a pack starting at a later physical ticket without locking the first scan", () => {
  assert.equal(remainingTicketsFromStartingTicket(20, 50), 31);
  assert.equal(expectedPhysicalTicket(20, 50, 31), 20);
});

test("maps remaining inventory to the physical ticket expected during an audit", () => {
  assert.equal(physicalTicketFromRemaining(1, 50, 50), 1);
  assert.equal(physicalTicketFromRemaining(1, 50, 42), 9);
  assert.equal(physicalTicketFromRemaining(20, 50, 30), 21);
  assert.equal(physicalTicketFromRemaining(1, 50, 0), 0);
});
