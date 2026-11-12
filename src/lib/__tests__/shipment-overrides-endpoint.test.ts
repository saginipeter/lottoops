import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { NextRequest } from "next/server";

test("shipment override report serializes database IDs and surfaces query failures", async (context) => {
  const require = createRequire(import.meta.url);
  const sessionPath = require.resolve("../api-session");
  const prismaPath = require.resolve("../prisma");
  const originals = [require.cache[sessionPath], require.cache[prismaPath]];
  let session: { storeId: string; userId: string; role: string } | null = null;
  let queryError: Error | null = null;
  let query = "";
  let parameters: unknown[] = [];
  let row: {
    id: string; storeId: string; storeName: string; detail: string; performedByName: string;
    createdAt: Date; expectedPackQuantity: number | null; recordedPackQuantity: number | null; quantityUnit: string | null;
  } = {
    id: "9007199254740993",
    storeId: "store-1",
    storeName: "Central",
    detail: "Approved short shipment after recount.",
    performedByName: "Manager",
    createdAt: new Date("2026-11-09T10:00:00.000Z"),
    expectedPackQuantity: 12,
    recordedPackQuantity: 10,
    quantityUnit: "PACKS",
  };

  const fakePrisma = {
    $queryRawUnsafe: async (sql: string, ...values: unknown[]) => {
      query = sql;
      parameters = values;
      if (queryError) throw queryError;
      return [row];
    },
  };

  require.cache[sessionPath] = {
    id: sessionPath,
    filename: sessionPath,
    loaded: true,
    exports: { getApiSession: async () => session },
  } as NodeJS.Module;
  require.cache[prismaPath] = {
    id: prismaPath,
    filename: prismaPath,
    loaded: true,
    exports: { prisma: fakePrisma },
  } as NodeJS.Module;
  context.after(() => {
    for (const [index, path] of [sessionPath, prismaPath].entries()) {
      if (originals[index]) require.cache[path] = originals[index];
      else delete require.cache[path];
    }
  });

  const { GET } = await import("../../app/api/notifications/overrides/route");
  const request = () => new NextRequest("http://localhost/api/notifications/overrides?from=2026-11-01&to=2026-11-09");

  const unauthenticated = await GET(request());
  assert.equal(unauthenticated.status, 401);

  session = { storeId: "store-1", userId: "manager-1", role: "MANAGER" };
  const response = await GET(request());
  assert.equal(response.status, 200);
  assert.match(query, /logs\.id::text AS id/);
  assert.deepEqual(parameters.slice(0, 3), ["MANAGER", "manager-1", "store-1"]);
  const data = await response.json();
  assert.equal(data.notifications.length, 1);
  assert.equal(data.notifications[0].id, "9007199254740993");
  assert.equal(data.notifications[0].detail, "Approved short shipment after recount.");
  assert.equal(data.notifications[0].expectedPackQuantity, 12);
  assert.equal(data.notifications[0].recordedPackQuantity, 10);
  assert.equal(data.notifications[0].quantityUnit, "PACKS");

  row = { ...row, expectedPackQuantity: null, recordedPackQuantity: null, quantityUnit: null, detail: "Shipment override approved: expected 9 packs, recorded 7 packs." };
  const legacyResponse = await GET(request());
  const legacy = await legacyResponse.json();
  assert.equal(legacy.notifications[0].expectedPackQuantity, 9);
  assert.equal(legacy.notifications[0].recordedPackQuantity, 7);
  row = { ...row, detail: "Shipment override approved for invoice INV-004: expected 12, scanned 9. Approved after the receiving recount." };
  const previousFormatResponse = await GET(request());
  const previousFormat = await previousFormatResponse.json();
  assert.equal(previousFormat.notifications[0].expectedPackQuantity, 12);
  assert.equal(previousFormat.notifications[0].recordedPackQuantity, 9);
  row = { ...row, detail: "Historical approval without reliable count data." };
  const noSnapshotResponse = await GET(request());
  const noSnapshot = await noSnapshotResponse.json();
  assert.equal(noSnapshot.notifications[0].expectedPackQuantity, null);
  assert.equal(noSnapshot.notifications[0].recordedPackQuantity, null);
  assert.match(query, /expected_pack_quantity/);
  assert.match(query, /recorded_pack_quantity/);

  queryError = new Error("database query failed");
  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    const failed = await GET(request());
    assert.equal(failed.status, 500);
    assert.deepEqual(await failed.json(), { error: "Unable to load shipment override report." });
  } finally {
    console.error = originalConsoleError;
  }
});
