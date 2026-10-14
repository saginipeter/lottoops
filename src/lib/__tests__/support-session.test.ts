import assert from "node:assert/strict";
import { test } from "node:test";
import { signSession, verifySession, type SessionPayload } from "../session";
import { canDelete, isOwner, resolveStoreId } from "../permissions";
import { NextRequest } from "next/server";

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

test("authorized support sessions cannot enroll, confirm, or disable owner MFA", async (t) => {
  const previousUrl = process.env.DATABASE_URL;
  const previousSecret = process.env.JWT_SECRET;
  const globalWithPrisma = globalThis as typeof globalThis & { prisma?: unknown };
  const previousPrisma = globalWithPrisma.prisma;
  process.env.DATABASE_URL = "support-security-test-database-not-used";
  process.env.JWT_SECRET = "support-security-test-only-secret";
  globalWithPrisma.prisma = {
    store: { async findFirst() { return { name: "Store" }; } },
    async $executeRawUnsafe() { return 0; },
    async $queryRawUnsafe(query: string) {
      return query.includes("SELECT r.id FROM support_access_requests") ? [{ id: "approval-id" }] : [];
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const headers = require("next/headers");
  const token = await signSession({ ...session, supportAccessId: "approval-id" });
  t.mock.method(headers, "cookies", async () => ({ get: () => ({ value: token }) }));
  t.after(() => {
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
    globalWithPrisma.prisma = previousPrisma;
  });
  const mfa = await import("@/app/api/auth/mfa/setup/route");
  for (const body of [{}, { code: "123456" }]) {
    const response = await mfa.POST(new NextRequest("http://localhost/api/auth/mfa/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }));
    assert.equal(response.status, 403);
  }
  assert.equal((await mfa.DELETE()).status, 403);
});
