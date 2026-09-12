import assert from "node:assert/strict";
import test from "node:test";
import type { SessionPayload } from "@/lib/session";
import { canAccessReports, canManageBackstock, canManageDisplay, hasPermission, isReadOnly } from "@/lib/permissions";

const auditor = {
  userId: "auditor-1",
  storeId: "store-1",
  storeName: "Test Store",
  name: "Auditor",
  email: "auditor@test.local",
  role: "AUDITOR",
  grantedPermissions: [],
} satisfies SessionPayload;

test("Auditor can review reports but cannot manage inventory", () => {
  assert.equal(isReadOnly(auditor), true);
  assert.equal(canAccessReports(auditor), true);
  assert.equal(canManageBackstock(auditor), false);
});

test("employees cannot mutate inventory or display state", () => {
  const employee = { ...auditor, role: "EMPLOYEE" } satisfies SessionPayload;
  assert.equal(hasPermission(employee, "RECEIVE_SHIPMENTS"), false);
  assert.equal(canManageBackstock(employee), false);
  assert.equal(canManageDisplay(employee), false);
});

test("shift leads only receive explicitly granted operational permissions", () => {
  const shiftLead = { ...auditor, role: "SHIFT_LEAD", grantedPermissions: ["MANAGE_DISPLAY"] } satisfies SessionPayload;
  assert.equal(canManageDisplay(shiftLead), true);
  assert.equal(canManageBackstock(shiftLead), false);
  assert.equal(canAccessReports(shiftLead), false);
});
