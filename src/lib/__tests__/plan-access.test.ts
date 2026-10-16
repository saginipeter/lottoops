import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import type { SessionPayload } from "@/lib/session";

test("plan access uses the assigned store subscription for active staff", async (context) => {
  const require = createRequire(import.meta.url);
  const prismaPath = require.resolve("../prisma");
  const planAccessPath = require.resolve("../plan-access");
  const originals = [require.cache[prismaPath], require.cache[planAccessPath]];
  const originalBilling = process.env.BILLING_ENABLED;
  const session: SessionPayload = {
    userId: "manager", storeId: "store", storeName: "Store", name: "Manager",
    email: "manager@example.test", role: "MANAGER", grantedPermissions: [],
  };
  const users = [
    { id: "owner", role: "OWNER", active: true },
    { id: "manager", role: "MANAGER", active: true },
    { id: "employee", role: "EMPLOYEE", active: true },
    { id: "inactive", role: "MANAGER", active: false },
  ];
  let subscription: { status: string; plan: { key: string } } | null = {
    status: "ACTIVE", plan: { key: "COMMAND" },
  };
  let organizationId: string | null = "organization";
  let subscriptionReads = 0;
  type StoreQuery = {
    where: {
      id: string;
      OR: Array<{
        ownerUserId?: string;
        users?: { some: { id: string; active: boolean; role?: string } };
      }>;
    };
  };
  const prisma = {
    store: {
      findFirst: async ({ where }: StoreQuery) => {
        const authorized = where.id === "store" && where.OR.some((condition) => {
          if (condition.ownerUserId) return condition.ownerUserId === "owner";
          const member = condition.users?.some;
          return member && users.some((user) => user.id === member.id
            && user.active === member.active && (!member.role || user.role === member.role));
        });
        return authorized ? { organizationId } : null;
      },
    },
    subscription: {
      findUnique: async ({ where }: { where: { organizationId: string } }) => {
        assert.equal(where.organizationId, "organization");
        subscriptionReads++;
        return subscription;
      },
    },
  };
  require.cache[prismaPath] = {
    id: prismaPath, filename: prismaPath, loaded: true, exports: { prisma },
  } as NodeJS.Module;
  delete require.cache[planAccessPath];
  process.env.BILLING_ENABLED = "true";
  try {
    const { getPlanAccess } = require("../plan-access") as typeof import("../plan-access");

    await context.test("managers and owners inherit the store's eligible subscription", async () => {
      for (const identity of [
        session,
        { ...session, userId: "owner", role: "OWNER" as const },
      ]) {
        for (const status of ["ACTIVE", "TRIALING"]) {
          subscription = { status, plan: { key: "COMMAND" } };
          const access = await getPlanAccess(identity, "LIVE_DISPLAY");
          assert.equal(access.allowed, true);
          assert.equal(access.planKey, "COMMAND");
        }
      }
    });

    await context.test("membership resolves entitlements without granting managerial permissions", async () => {
      const { isManagerOrAbove } = require("../permissions") as typeof import("../permissions");
      const employee = { ...session, userId: "employee", role: "EMPLOYEE" as const };
      assert.equal((await getPlanAccess(employee, "LIVE_DISPLAY")).allowed, true);
      assert.equal(isManagerOrAbove(employee), false);
    });

    await context.test("inactive members, outsiders, and other stores remain denied", async () => {
      const reads = subscriptionReads;
      for (const identity of [
        { ...session, userId: "inactive" },
        { ...session, userId: "outsider" },
        { ...session, storeId: "another-store" },
      ]) {
        const access = await getPlanAccess(identity, "LIVE_DISPLAY");
        assert.equal(access.allowed, false);
        assert.equal(access.reason, "NO_SUBSCRIPTION");
      }
      assert.equal(subscriptionReads, reads);
    });

    await context.test("lower plans and inactive or missing subscriptions remain denied", async () => {
      for (const key of ["CONTROL", "BASE"]) {
        subscription = { status: "ACTIVE", plan: { key } };
        const access = await getPlanAccess(session, "LIVE_DISPLAY");
        assert.equal(access.allowed, false);
        assert.equal(access.reason, "PLAN_NOT_INCLUDED");
      }
      subscription = { status: "CANCELED", plan: { key: "COMMAND" } };
      assert.equal((await getPlanAccess(session, "LIVE_DISPLAY")).reason, "INACTIVE_SUBSCRIPTION");
      subscription = null;
      assert.equal((await getPlanAccess(session, "LIVE_DISPLAY")).reason, "NO_SUBSCRIPTION");
      organizationId = null;
      assert.equal((await getPlanAccess(session, "LIVE_DISPLAY")).allowed, false);
    });

    await context.test("billing-disabled and platform-admin bypasses remain unchanged", async () => {
      const reads = subscriptionReads;
      assert.equal((await getPlanAccess({ ...session, role: "PLATFORM_ADMIN" }, "LIVE_DISPLAY")).allowed, true);
      process.env.BILLING_ENABLED = "false";
      assert.equal((await getPlanAccess(session, "LIVE_DISPLAY")).allowed, true);
      assert.equal(subscriptionReads, reads);
    });
  } finally {
    [prismaPath, planAccessPath].forEach((path, index) => {
      if (originals[index]) require.cache[path] = originals[index];
      else delete require.cache[path];
    });
    if (originalBilling === undefined) delete process.env.BILLING_ENABLED;
    else process.env.BILLING_ENABLED = originalBilling;
  }
});
