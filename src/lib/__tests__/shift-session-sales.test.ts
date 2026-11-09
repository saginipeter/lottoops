import assert from "node:assert/strict";
import test from "node:test";
import { aggregateOperatorSessionSales, type ShiftSessionSaleRow } from "../shift-session-sales";

const row = (overrides: Partial<ShiftSessionSaleRow> = {}): ShiftSessionSaleRow => ({
  shiftId: "shift-1",
  sessionId: "login-a",
  employeeId: "employee-a",
  employeeName: "Cashier A",
  terminalId: "T1",
  signedInAt: "2026-11-09T08:00:00.000Z",
  endedAt: null,
  packId: "pack-2",
  pack: "Pack 2",
  game: "Texas Cash",
  display: "2",
  tickets: 1,
  sales: "2.00",
  firstSaleAt: "2026-11-09T08:10:00.000Z",
  lastSaleAt: "2026-11-09T08:10:00.000Z",
  hasEstimatedPrice: false,
  ...overrides,
});

test("aggregates sales by shift, employee login, terminal, and pack", () => {
  const sessions = aggregateOperatorSessionSales([
    row(),
    row({ packId: "pack-10", pack: "Pack 10", display: "10", tickets: 2, sales: 4 }),
    row({ packId: "pack-1", pack: "Pack 1", display: "1", tickets: 3, sales: 6 }),
    row({ sessionId: "login-b", tickets: 4, sales: 8, terminalId: "T1" }),
    row({ sessionId: "login-a", tickets: 5, sales: 10, terminalId: "T2" }),
    row({ sessionId: "login-a", shiftId: "shift-2", tickets: 6, sales: 12, terminalId: "T1" }),
  ]);

  assert.equal(sessions.length, 4, "different sign-ins, terminals, and shifts remain distinct");
  const sessionA = sessions.find((entry) => entry.sessionId === "login-a" && entry.shiftId === "shift-1" && entry.terminalId === "T1");
  assert.ok(sessionA);
  assert.equal(sessionA.employeeName, "Cashier A");
  assert.equal(sessionA.tickets, 6);
  assert.equal(sessionA.grossSales, 12);
  assert.deepEqual(sessionA.packs.map((pack) => pack.display), ["1", "2", "10"]);
});

test("keeps historical events without login IDs visibly unattributed", () => {
  const [session] = aggregateOperatorSessionSales([
    row({ sessionId: null, terminalId: null, hasEstimatedPrice: true }),
  ]);
  assert.equal(session.legacyAttribution, true);
  assert.equal(session.employeeName, "Cashier A");
  assert.equal(session.terminalId, null);
  assert.equal(session.hasEstimatedPrice, true);
});
