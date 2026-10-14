import assert from "node:assert/strict";
import { test } from "node:test";
import { signSession, verifySession, type SessionPayload } from "../session";
import { canDelete, isOwner, resolveStoreId } from "../permissions";

const session: SessionPayload = {
  userId: "owner-id",
  storeId: "store-id",
  storeName: "Store",
  name: "Owner",
  email: "owner@example.test",
  role: "MANAGER",
  grantedPermissions: [],
  impersonatedBy: {
    userId: "admin-id",
    name: "Support",
    email: "admin@example.test",
  },
};

test("support sessions cannot use the owner's identity to escape their store scope", () => {
  const supportSession = { ...session, supportAccessId: "approval-id" };
  assert.equal(resolveStoreId(supportSession, "another-owned-store"), session.storeId);
  assert.equal(resolveStoreId(supportSession, session.storeId), session.storeId);
  assert.equal(isOwner(supportSession), false);
  assert.equal(canDelete(supportSession), false);
});

test("support sessions require owner authorization and a store-scoped role", async () => {
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "support-session-test-only-secret";
  try {
    assert.equal(await verifySession(await signSession(session)), null);
    assert.equal(await verifySession(await signSession({
      ...session, role: "OWNER", supportAccessId: "approval-id",
    })), null);
    const verified = await verifySession(await signSession({
      ...session, supportAccessId: "approval-id",
    }));
    assert.equal(verified?.supportAccessId, "approval-id");
    assert.equal(verified?.role, "MANAGER");
    assert.ok(verified?.impersonatedBy);
    const normal = await verifySession(await signSession({
      ...session, role: "OWNER", impersonatedBy: undefined,
    }));
    assert.equal(normal?.role, "OWNER");
  } finally {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  }
});
