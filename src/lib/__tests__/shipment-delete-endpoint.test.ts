import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { NextRequest } from "next/server";

test("shipment deletion locks the in-progress shipment before detaching or deleting packs", async (context) => {
  const require = createRequire(import.meta.url);
  const paths = ["../api-session", "../prisma"].map((path) => require.resolve(path));
  const originals = paths.map((path) => require.cache[path]);
  const session = { userId: "manager", storeId: "store", name: "Manager", role: "MANAGER", grantedPermissions: [] };
  let shipmentLocked = true;
  const calls: string[] = [];
  const tx = {
    $queryRawUnsafe: async (sql: string, ...values: unknown[]) => {
      calls.push("shipment.lock");
      assert.match(sql, /status = 'IN_PROGRESS' FOR UPDATE/);
      assert.deepEqual(values, ["shipment", "store"]);
      return shipmentLocked ? [{ id: "shipment" }] : [];
    },
    pack: {
      findMany: async () => { calls.push("packs.read"); return []; },
      updateMany: async () => { calls.push("packs.detach"); return { count: 0 }; },
      deleteMany: async () => { calls.push("packs.delete"); return { count: 0 }; },
    },
    shipment: { delete: async () => { calls.push("shipment.delete"); return {}; } },
  };
  const fakePrisma = {
    shipment: { findFirst: async () => ({ id: "shipment" }) },
    $transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx),
  };
  require.cache[paths[0]] = { id: paths[0], filename: paths[0], loaded: true, exports: { getApiSession: async () => session } } as NodeJS.Module;
  require.cache[paths[1]] = { id: paths[1], filename: paths[1], loaded: true, exports: { prisma: fakePrisma } } as NodeJS.Module;
  context.after(() => paths.forEach((path, index) => {
    if (originals[index]) require.cache[path] = originals[index];
    else delete require.cache[path];
  }));

  const { DELETE } = await import("../../app/api/shipments/route");
  const request = () => new NextRequest("http://localhost/api/shipments", {
    method: "DELETE", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shipmentId: "shipment" }),
  });

  const deleted = await DELETE(request());
  assert.equal(deleted.status, 200);
  assert.deepEqual(calls, ["shipment.lock", "packs.read", "packs.delete", "shipment.delete"]);

  shipmentLocked = false;
  calls.length = 0;
  const alreadyConfirmed = await DELETE(request());
  assert.equal(alreadyConfirmed.status, 200);
  assert.deepEqual(await alreadyConfirmed.json(), { success: true, cleared: false });
  assert.deepEqual(calls, ["shipment.lock"], "a no-longer-in-progress shipment is left untouched");
});
