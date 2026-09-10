import assert from "node:assert/strict";
import test from "node:test";
import { canAuthorizeCorrection, canSelfResolveSequenceLock } from "@/lib/control-validation";

test("only the exact expected ticket can self-resolve a sequence lock", () => {
  assert.equal(canSelfResolveSequenceLock(true, 42, 42), true);
  assert.equal(canSelfResolveSequenceLock(true, 42, 41), false);
  assert.equal(canSelfResolveSequenceLock(false, 42, 42), false);
  assert.equal(canSelfResolveSequenceLock(true, null, 42), false);
});

test("only managers and owners can authorize corrections", () => {
  assert.equal(canAuthorizeCorrection("OWNER"), true);
  assert.equal(canAuthorizeCorrection("MANAGER"), true);
  assert.equal(canAuthorizeCorrection("SHIFT_LEAD"), false);
  assert.equal(canAuthorizeCorrection("EMPLOYEE"), false);
});