import assert from "node:assert/strict";
import { test } from "node:test";
import { shouldEnforceInactivityTimeout } from "../inactivity-policy";

test("remembered manager and owner sessions are not ended by the short inactivity timer", () => {
  assert.equal(shouldEnforceInactivityTimeout("MANAGER", true), false);
  assert.equal(shouldEnforceInactivityTimeout("OWNER", true), false);
});

test("manager and owner sessions without Remember Me retain the inactivity timeout", () => {
  assert.equal(shouldEnforceInactivityTimeout("MANAGER", false), true);
  assert.equal(shouldEnforceInactivityTimeout("OWNER"), true);
});

test("roles that were never subject to the manager/owner idle timeout remain unchanged", () => {
  assert.equal(shouldEnforceInactivityTimeout("EMPLOYEE", true), false);
  assert.equal(shouldEnforceInactivityTimeout("EMPLOYEE", false), false);
  assert.equal(shouldEnforceInactivityTimeout("SHIFT_LEAD", false), false);
});
