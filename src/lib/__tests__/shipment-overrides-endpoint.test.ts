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

  const fakePrisma = {
    $queryRawUnsafe: async (sql: string, ...values: unknown[]) => {
      query = sql;
      parameters = values;
      if (queryError) throw queryError;
      return [{
        id: "9007199254740993",
        storeId: "store-1",
        storeName: "Central",
        detail: "Approved short shipment after recount.",
        performedByName: "Manager",
        createdAt: new Date("2026-11-09T10:00:00.000Z"),
      }];
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
