import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { NextRequest } from "next/server";

test("back-stock shipment confirmation revalidates received pack count under the shipment lock", async (context) => {
  const require = createRequire(import.meta.url);
  const paths = ["../get-session", "../prisma"].map((path) => require.resolve(path));
  const originals = paths.map((path) => require.cache[path]);
  const session = { userId: "manager", storeId: "store", name: "Manager", role: "MANAGER", grantedPermissions: [] };
  const shipment = { id: "shipment", storeId: "store", status: "IN_PROGRESS", expectedPacks: 1, invoiceNumber: "INV-1" };
  let currentReceivingPackCount = 2;
  let insideTransaction = false;
  let packUpdates = 0;
  let shipmentUpdates = 0;
  const lockedQueries: string[] = [];
  const tx = {
    $queryRawUnsafe: async (sql: string) => {
      lockedQueries.push(sql);
      if (sql.includes("FROM shipments")) return [{ id: shipment.id, expectedPacks: shipment.expectedPacks }];
      if (sql.includes("FROM inventory_activity_logs")) return [];
      throw new Error(`Unexpected transaction query: ${sql}`);
    },
    pack: {
      findMany: async () => Array.from({ length: currentReceivingPackCount }, (_, index) => ({ id: `pack-${index}`, ticketPrice: 2, ticketQuantity: 50 })),
      updateMany: async () => { packUpdates++; return { count: currentReceivingPackCount }; },
    },
    shipment: {
      update: async ({ data }: { data: Record<string, unknown> }) => { shipmentUpdates++; return { ...shipment, ...data }; },
    },
  };
  const fakePrisma = {
    shipment: { findUnique: async () => shipment },
    pack: {
      findMany: async () => [{ id: "pack-0", ticketPrice: 2, ticketQuantity: 50 }],
    },
    $transaction: async (callback: (transaction: typeof tx) => Promise<unknown>, options?: { isolationLevel: string }) => {
      assert.equal(options?.isolationLevel, "Serializable");
      insideTransaction = true;
      try { return await callback(tx); }
      finally { insideTransaction = false; }
    },
  };
  require.cache[paths[0]] = { id: paths[0], filename: paths[0], loaded: true, exports: { getSession: async () => session } } as NodeJS.Module;
  require.cache[paths[1]] = { id: paths[1], filename: paths[1], loaded: true, exports: { prisma: fakePrisma } } as NodeJS.Module;
  context.after(() => paths.forEach((path, index) => {
    if (originals[index]) require.cache[path] = originals[index];
    else delete require.cache[path];
  }));

  const { POST } = await import("../../app/api/shipments/confirm/route");
  const request = () => new NextRequest("http://localhost/api/shipments/confirm", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shipmentId: shipment.id, destination: "back-stock", expectedRetailValue: 95 }),
  });

  const rejected = await POST(request());
  assert.equal(rejected.status, 400);
  assert.match((await rejected.json()).error, /Expected 1 packs but scanned 2/);
  assert.ok(lockedQueries[0].includes("FROM shipments"), "the shipment row is locked before the transactional pack count read");
  assert.equal(packUpdates, 0, "a newly received pack is never left RECEIVING after shipment confirmation");
  assert.equal(shipmentUpdates, 0, "a stale snapshot cannot mark the shipment received");

  currentReceivingPackCount = 1;
  lockedQueries.length = 0;
  const accepted = await POST(request());
  assert.equal(accepted.status, 200);
  assert.equal(packUpdates, 1);
  assert.equal(shipmentUpdates, 1);
  assert.equal(lockedQueries[0].includes("FROM shipments"), true);
  assert.equal(insideTransaction, false);
});
