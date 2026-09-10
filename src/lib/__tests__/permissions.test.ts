import assert from "node:assert/strict";
import test from "node:test";
import type { SessionPayload } from "@/lib/session";
import { canAccessReports, canManageBackstock, isReadOnly } from "@/lib/permissions";

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