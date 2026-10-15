import assert from "node:assert/strict";
import test from "node:test";
import { calculatePhysicalAuditInventory, calculatePhysicalAuditVariance, expectedPhysicalTicket, expectedPhysicalTicketByDirection, findUnassignedActivePacks, physicalTicketFromRemaining, remainingTicketsFromStartingTicket, validateEndingTicket } from "@/lib/core-validation";

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

test("calculates signed physical audit variance against system expectation", () => {
  assert.equal(calculatePhysicalAuditVariance(43, 43), 0);
  assert.equal(calculatePhysicalAuditVariance(9, 8), -1);
  assert.equal(calculatePhysicalAuditVariance(3, 2), -1);
  assert.equal(calculatePhysicalAuditVariance(3, 4), 1);
  assert.equal(calculatePhysicalAuditVariance(-1, 2), null);
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

test("150 beginning tickets minus ten sales leaves 140 in either display direction", () => {
  for (const [direction, ticket] of [["FIRST", 11], ["LAST", 140]] as const) {
    assert.deepEqual(calculatePhysicalAuditInventory(1, 150, 150 - 10, ticket, direction), {
      expectedTicket: ticket, remaining: 140, variance: 0, scannedSoldTicket: false,
    });
  }
});

test("ascending audit mis-scans preserve signed ID variance without restoring sold stock", () => {
  assert.deepEqual(calculatePhysicalAuditInventory(1, 150, 141, 11, "FIRST"), {
    expectedTicket: 10, remaining: 140, variance: 1, scannedSoldTicket: false,
  });
  assert.deepEqual(calculatePhysicalAuditInventory(1, 150, 141, 9, "FIRST"), {
    expectedTicket: 10, remaining: 141, variance: -1, scannedSoldTicket: true,
  });
});

test("descending audit excludes previously sold tickets and preserves ID variance", () => {
  assert.deepEqual(calculatePhysicalAuditInventory(1, 150, 140, 141, "LAST"), {
    expectedTicket: 140, remaining: 140, variance: 1, scannedSoldTicket: true,
  });
  assert.deepEqual(calculatePhysicalAuditInventory(1, 150, 140, 139, "LAST"), {
    expectedTicket: 140, remaining: 139, variance: -1, scannedSoldTicket: false,
  });
});

test("empty packs never regain inventory from scanning a sold ticket", () => {
  for (const direction of ["FIRST", "LAST"]) {
    assert.equal(expectedPhysicalTicketByDirection(1, 150, 0, direction), 0);
    assert.equal(calculatePhysicalAuditInventory(1, 150, 0, 1, direction)?.remaining, 0);
    assert.equal(calculatePhysicalAuditInventory(1, 150, 0, 0, direction)?.variance, 0);
  }
});

test("audit inventory handles partial packs and rejects invalid sequence states", () => {
  assert.equal(calculatePhysicalAuditInventory(20, 150, 121, 30, "FIRST")?.remaining, 121);
  assert.equal(calculatePhysicalAuditInventory(20, 150, 121, 19, "FIRST"), null);
  for (const direction of ["FIRST", "LAST"]) {
    for (const remaining of [-1, 151, 1.5, NaN]) {
      assert.equal(calculatePhysicalAuditInventory(1, 150, remaining, 10, direction), null);
    }
    assert.equal(calculatePhysicalAuditInventory(1, 150, 140, 151, direction), null);
  }
});
