import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { NextRequest } from "next/server";

test("correction report resolves an internal pack ID to a readable serial/game label", async (context) => {
  const require = createRequire(import.meta.url);
  const paths = ["../api-session", "../prisma"].map((path) => require.resolve(path));
  const originals = paths.map((path) => require.cache[path]);
  let sql = "";
  let params: unknown[] = [];
  const session = { storeId: "store-authorized", storeName: "Central", userId: "manager", name: "Manager", role: "MANAGER" };
  const fakePrisma = {
    $queryRawUnsafe: async (query: string, ...values: unknown[]) => {
      sql = query;
      params = values;
      return [{
        entityType: "PACK",
        entityLabel: "Pack 000123 · Lucky Game (Game 004)",
        fieldName: "currentTicketNumber",
        oldValue: "10",
        newValue: "9",
        reason: "Physical ticket recounted",
        correctedByName: "Manager",
        createdAt: new Date("2026-11-09T10:00:00.000Z"),
      }];
    },
  };
  const replacements = [{ getApiSession: async () => session }, { prisma: fakePrisma }];
  paths.forEach((path, index) => {
    require.cache[path] = { id: path, filename: path, loaded: true, exports: replacements[index] } as NodeJS.Module;
  });
  context.after(() => {
    paths.forEach((path, index) => {
      if (originals[index]) require.cache[path] = originals[index];
      else delete require.cache[path];
    });
  });

  const { GET } = await import("../../app/api/reports/corrections/route");
  const response = await GET(new NextRequest("http://localhost/api/reports/corrections?from=2026-11-01&to=2026-11-09"));
  assert.equal(response.status, 200);
  assert.match(sql, /LEFT JOIN packs/);
  assert.match(sql, /LEFT JOIN games/);
  assert.doesNotMatch(sql, /logs\.id|entity_id AS "entityId"/);
  assert.deepEqual(params.slice(0, 1), ["store-authorized"]);
  const data = await response.json();
  assert.equal(data.corrections[0].entityLabel, "Pack 000123 · Lucky Game (Game 004)");
  assert.equal("id" in data.corrections[0], false);
  assert.equal("entityId" in data.corrections[0], false);
  assert.equal("correctedById" in data.corrections[0], false);
  assert.doesNotMatch(JSON.stringify(data.corrections), /cmvr|Entity ID/);
});
