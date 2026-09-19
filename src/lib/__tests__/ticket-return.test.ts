import assert from "node:assert/strict";
import test from "node:test";
import {
  EMPLOYEE_SELF_RETURN_LIMIT,
  canEmployeeSelfReturn,
} from "@/lib/ticket-return";

const now = new Date("2026-09-19T12:00:00.000Z");

function eligibility(overrides: Partial<Parameters<typeof canEmployeeSelfReturn>[0]> = {}) {
  return canEmployeeSelfReturn({
    role: "EMPLOYEE",
    requestedBarcode: "24240001234007",
    latestBarcode: "24240001234007",
    latestScannedAt: new Date(now.getTime() - 30_000),
    priorSelfReturns: 0,
    now,
    ...overrides,
  });
}

test("employee can self-return the latest ticket within two minutes", () => {
  assert.equal(eligibility(), true);
});

test("employee cannot self-return an older or different ticket", () => {
  assert.equal(eligibility({ requestedBarcode: "24240001234006" }), false);
});

test("employee cannot self-return after the two-minute window", () => {
  assert.equal(eligibility({ latestScannedAt: new Date(now.getTime() - 120_001) }), false);
});

test("employee cannot exceed the per-shift self-return limit", () => {
  assert.equal(eligibility({ priorSelfReturns: EMPLOYEE_SELF_RETURN_LIMIT }), false);
});

test("non-employees continue through manager approval", () => {
  assert.equal(eligibility({ role: "MANAGER" }), false);
});
