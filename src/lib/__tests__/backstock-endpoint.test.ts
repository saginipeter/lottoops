import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { NextRequest } from "next/server";

test("backstock endpoint scopes inventory and returns recoverable database errors", async (context) => {
  const require = createRequire(import.meta.url);
  const sessionPath = require.resolve("../api-session");
  const prismaPath = require.resolve("../prisma");
  const originals = [require.cache[sessionPath], require.cache[prismaPath]];
  let session: { storeId: string } | null = null;
  let database: unknown = null;
  let shouldFail = false;
  let expectedWhere: unknown;
  require.cache[sessionPath] = {
    id: sessionPath, filename: sessionPath, loaded: true,
    exports: { getApiSession: async () => session },
  } as NodeJS.Module;
  require.cache[prismaPath] = {
    id: prismaPath, filename: prismaPath, loaded: true,
    exports: { get prisma() { return database; } },
  } as NodeJS.Module;
  context.after(() => {
    for (const [index, path] of [sessionPath, prismaPath].entries()) {
      if (originals[index]) require.cache[path] = originals[index];
      else delete require.cache[path];
    }
  });
  const { GET } = await import("../../app/api/packs/back-stock/route");
  const request = (query = "") => new NextRequest(`http://localhost/api/packs/back-stock${query}`);
  assert.equal((await GET(request())).status, 401);
  session = { storeId: "authorized-store" };
  assert.equal((await GET(request())).status, 503);
  database = {
    pack: {
      findMany: async (query: { where: unknown; include: unknown; orderBy: unknown }) => {
        assert.deepEqual(query.where, expectedWhere);
        assert.deepEqual(query.include, { game: true, shipment: true });
        assert.deepEqual(query.orderBy, { receivedAt: "desc" });
        if (shouldFail) throw new Error("Database unavailable");
        return [{ id: "pack-1" }];
      },
    },
  };
  expectedWhere = { storeId: "authorized-store", status: "BACK_STOCK" };
  const response = await GET(request("?storeId=other-store"));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), [{ id: "pack-1" }]);
  expectedWhere = {
    storeId: "authorized-store",
    OR: [{ status: "BACK_STOCK" }, { status: "ACTIVE", slot: null }],
  };
  assert.equal((await GET(request("?includeActive=true"))).status, 200);
  shouldFail = true;
  const failure = await GET(request("?includeActive=true"));
  assert.equal(failure.status, 500);
  assert.match((await failure.json()).error, /retry/i);
});
