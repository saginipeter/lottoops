import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);

test("Back Stock report is authorized and returns store-scoped pack and 100%/95% totals", async (context) => {
  const paths = ["../api-session", "../permissions", "../prisma"].map((path) => require.resolve(path));
  const originals = paths.map((path) => require.cache[path]);
  let session: { storeId: string; role: string } | null = null;
  const calls: unknown[] = [];
  const database = {
    prisma: {
      pack: {
        aggregate: async (query: unknown) => {
          calls.push(query);
          return { _count: { _all: 60 }, _sum: { retailValue: "50000.00" } };
        },
      },
    },
  };
  const replacements = [
    { getApiSession: async () => session },
    { canAccessReports: (candidate: { role: string }) => candidate.role === "OWNER" || candidate.role === "MANAGER" || candidate.role === "AUDITOR" },
    database,
  ];
  paths.forEach((path, index) => {
    require.cache[path] = { id: path, filename: path, loaded: true, exports: replacements[index] } as NodeJS.Module;
  });
  context.after(() => {
    paths.forEach((path, index) => {
      if (originals[index]) require.cache[path] = originals[index];
      else delete require.cache[path];
    });
  });

  const { GET } = await import("../../app/api/reports/back-stock/route");
  assert.equal((await GET()).status, 401);
  session = { storeId: "store-approved", role: "OWNER" };
  const response = await GET();
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.totalPackQuantity, 60);
  assert.equal(data.totalRetailValue, 50000);
  assert.equal(data.costPayout95, 47500);
  assert.equal(typeof data.generatedAt, "string");
  const query = calls[0] as { where: { storeId: string; status: string }; _count: { _all: boolean }; _sum: { retailValue: boolean } };
  assert.deepEqual(query, {
    where: { storeId: "store-approved", status: "BACK_STOCK" },
    _count: { _all: true },
    _sum: { retailValue: true },
  });
});
