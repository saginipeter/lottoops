import assert from "node:assert/strict";
import test from "node:test";
import { getPlatformStoreOwners } from "@/lib/platform-store-owners";

test("platform store metadata resolves actual owner IDs without restricting their home store", async () => {
  const db = {
    user: {
      async findMany(args: unknown) {
        assert.deepEqual(args, {
          where: { id: { in: ["portfolio-owner", "missing-owner"] } },
          select: { id: true, name: true, email: true },
        });
        return [{ id: "portfolio-owner", name: "Portfolio Owner", email: "owner@example.test" }];
      },
    },
  };
  const owners = await getPlatformStoreOwners(["portfolio-owner", "portfolio-owner", "missing-owner", null], db);
  assert.deepEqual(owners.get("portfolio-owner"), { name: "Portfolio Owner", email: "owner@example.test" });
  assert.equal(owners.has("missing-owner"), false);
  assert.equal(owners.has("store-local-owner"), false);
});

test("no owner IDs avoids a user query or fallback to unrelated store-local users", async () => {
  const db = { user: { async findMany() { throw new Error("Query must not run"); } } };
  assert.equal((await getPlatformStoreOwners([null], db)).size, 0);
});
