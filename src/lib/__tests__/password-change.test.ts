import assert from "node:assert/strict";
import test from "node:test";
import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { signSession, type SessionPayload } from "@/lib/session";
import { verifyPasswordChange } from "@/lib/password-change";

test("password changes validate types and verify the target account's password", async () => {
  const hash = await bcrypt.hash("customer-current-password", 4);
  for (const value of [undefined, null, "", 12345678, {}, []]) {
    assert.equal((await verifyPasswordChange(value, "new-password", hash)).status, 400);
  }
  for (const value of [undefined, null, "", "short", 12345678, {}, []]) {
    assert.equal((await verifyPasswordChange("customer-current-password", value, hash)).status, 400);
  }
  assert.equal((await verifyPasswordChange("admin-password", "new-password", hash)).status, 403);
  assert.deepEqual(await verifyPasswordChange("customer-current-password", "new-password", hash), {
    password: "new-password",
  });
});

test("password and account-management endpoints enforce credential and support boundaries", async (t) => {
  const targetHash = await bcrypt.hash("customer-current-password", 4);
  const adminHash = await bcrypt.hash("admin-password", 4);
  let role: SessionPayload["role"] = "PLATFORM_ADMIN";
  let updates: Array<{ where: { id: string }; data: Record<string, unknown> }> = [];
  let creates: Array<{ data: Record<string, unknown> }> = [];
  let revoked: string[] = [];
  let reused = false;
  const target = { id: "customer", role: "EMPLOYEE", active: true, passwordHash: targetHash };
  const db = {
    user: {
      async findFirst({ where }: { where: { id?: string } }) {
        return where.id === "operator"
          ? { id: "operator", name: "Operator", email: "operator@example.test", role, store: { name: "Store" }, grantedPermissions: [], passwordHash: adminHash }
          : target;
      },
      async findMany() {
        return reused ? [{ passwordHash: await bcrypt.hash("new-password", 4) }] : [];
      },
      async findUnique() { return null; },
      async create(create: { data: Record<string, unknown> }) {
        creates.push(create);
        return { ...target, ...create.data };
      },
      async update(update: { where: { id: string }; data: Record<string, unknown> }) {
        updates.push(update);
        Object.assign(target, update.data);
        return { ...target };
      },
    },
    store: {
      async findFirst() { return { id: "store", name: "Store" }; },
    },
    async $executeRawUnsafe(query: string, userId?: string) {
      if (query.includes("INSERT INTO session_revocations") && userId) revoked.push(userId);
      return 0;
    },
    async $queryRawUnsafe(query: string) {
      return query.includes("SELECT r.id FROM support_access_requests") ? [{ id: "support-access" }] : [];
    },
  };
  const previousUrl = process.env.DATABASE_URL;
  const previousSecret = process.env.JWT_SECRET;
  const globalWithPrisma = globalThis as typeof globalThis & { prisma?: unknown };
  const previousPrisma = globalWithPrisma.prisma;
  process.env.DATABASE_URL = "password-test-database-not-used";
  process.env.JWT_SECRET = "password-route-test-signing-secret";
  globalWithPrisma.prisma = db;
  // Next's CommonJS entry point lets tests replace cookies without a request server.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const headers = require("next/headers");
  t.mock.method(headers, "cookies", async () => ({
    get: () => ({ value: token }),
  }));
  let token = "";
  t.after(() => {
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
    globalWithPrisma.prisma = previousPrisma;
  });
  const platform = await import("@/app/api/platform/users/route");
  const users = await import("@/app/api/users/[id]/route");
  const collection = await import("@/app/api/users/route");

  for (const operatorRole of ["PLATFORM_ADMIN", "OWNER", "MANAGER"] as const) {
    role = operatorRole;
    target.passwordHash = targetHash;
    token = await signSession({
      userId: "operator", storeId: "store", storeName: "Store", name: "Operator",
      email: "operator@example.test", role, grantedPermissions: [],
    });
    const patch = (body: unknown) => {
      const request = new NextRequest("http://localhost/api/users/customer", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return role === "PLATFORM_ADMIN" ? platform.PATCH(request) : users.PATCH(request, { params: Promise.resolve({ id: "customer" }) });
    };
    await t.test(`${role}: invalid credentials cannot change password or other fields`, async () => {
      for (const [body, status] of [
        [{ password: "new-password" }, 400],
        [{ currentPassword: "", password: "new-password" }, 400],
        [{ currentPassword: null, password: "new-password" }, 400],
        [{ currentPassword: 12345678, password: "new-password" }, 400],
        [{ currentPassword: {}, password: "new-password" }, 400],
        [{ currentPassword: [], password: "new-password" }, 400],
        [{ currentPassword: "admin-password", password: "new-password" }, 403],
        [{ currentPassword: "wrong-password", password: "new-password" }, 403],
        [{ currentPassword: "customer-current-password", password: null }, 400],
        [{ currentPassword: "customer-current-password", password: 12345678 }, 400],
        [{ currentPassword: "customer-current-password", password: {} }, 400],
        [{ currentPassword: "customer-current-password", password: "short" }, 400],
      ] as const) {
        updates = []; revoked = [];
        const response = await patch({ userId: "customer", active: false, name: "Changed", ...body });
        assert.equal(response.status, status);
        assert.deepEqual(updates, []);
        assert.deepEqual(revoked, []);
      }
      for (const body of [null, [], "password"]) {
        assert.equal((await patch(body)).status, 400);
      }
    });
    await t.test(`${role}: verified password changes retain uniqueness and revoke target sessions`, async () => {
      updates = []; revoked = []; reused = true;
      const body = { userId: "customer", currentPassword: "customer-current-password", password: "new-password" };
      assert.equal((await patch(body)).status, 409);
      assert.deepEqual(updates, []);
      assert.deepEqual(revoked, []);
      reused = false;
      updates = []; revoked = [];
      assert.equal((await patch(body)).status, 200);
      assert.equal(updates.length, 1);
      assert.equal(updates[0].where.id, "customer");
      assert.equal(await bcrypt.compare("new-password", String(updates[0].data.passwordHash)), true);
      assert.deepEqual(revoked, ["customer"]);
      updates = []; revoked = [];
      assert.equal((await patch(body)).status, 403);
      assert.deepEqual(updates, []);
      assert.deepEqual(revoked, []);
    });
    await t.test(`${role}: non-password updates do not require a current password`, async () => {
      updates = []; revoked = [];
      assert.equal((await patch({ userId: "customer", active: false })).status, 200);
      assert.deepEqual(updates[0].data, { active: false });
      assert.equal("passwordHash" in updates[0].data, false);
      if (role === "PLATFORM_ADMIN") {
        updates = []; revoked = [];
        assert.equal((await patch({ userId: "customer", revokeSessions: true })).status, 200);
        assert.deepEqual(updates, []);
        assert.deepEqual(revoked, ["customer"]);
      }
    });
    if (role !== "PLATFORM_ADMIN") {
      await t.test(`${role}: normal account creation and deletion remain available`, async () => {
        creates = [];
        const request = new NextRequest("http://localhost/api/users", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "New Staff", email: "staff@example.test", password: "new-staff-password", role: "EMPLOYEE" }),
        });
        assert.equal((await collection.POST(request)).status, 201);
        assert.equal(creates.length, 1);
        updates = [];
        assert.equal((await users.DELETE(
          new NextRequest("http://localhost/api/users/customer", { method: "DELETE" }),
          { params: Promise.resolve({ id: "customer" }) },
        )).status, 200);
        assert.deepEqual(updates[0].data, { active: false });
      });
    }
  }
  await t.test("authorized support sessions cannot create, edit, reset passwords, or delete accounts", async () => {
    target.passwordHash = targetHash;
    token = await signSession({
      userId: "operator", storeId: "store", storeName: "Store", name: "Owner",
      email: "owner@example.test", role: "MANAGER", grantedPermissions: [],
      impersonatedBy: { userId: "admin", name: "Admin", email: "admin@example.test" },
      supportAccessId: "support-access",
    });
    const { getApiSession } = await import("@/lib/api-session");
    assert.equal((await getApiSession())?.role, "MANAGER");
    creates = []; updates = []; revoked = [];
    const request = (method: string, body?: unknown) => new NextRequest("http://localhost/api/users/customer", {
      method, headers: { "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const response = await collection.POST(request("POST", {
      name: "Persistent Staff", email: "staff@example.test", role: "EMPLOYEE", password: "new-staff-password",
    }));
    assert.equal(response.status, 403);
    assert.match((await response.json()).error, /Support sessions/);
    for (const body of [
      { name: "Changed", email: "changed@example.test", role: "MANAGER", grantedPermissions: ["REPORTS"], employeeUserId: "new-id" },
      { currentPassword: "customer-current-password", password: "new-password" },
      { active: false },
    ]) {
      const response = await users.PATCH(request("PATCH", body), { params: Promise.resolve({ id: "customer" }) });
      assert.equal(response.status, 403);
      assert.match((await response.json()).error, /Support sessions/);
    }
    assert.equal((await users.DELETE(request("DELETE"), { params: Promise.resolve({ id: "customer" }) })).status, 403);
    assert.deepEqual(creates, []);
    assert.deepEqual(updates, []);
    assert.deepEqual(revoked, []);
  });
});
