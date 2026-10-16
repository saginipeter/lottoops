import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { NextRequest } from "next/server";

test("queued sales and reconciliation reject a changed store before database access", async (context) => {
  const require = createRequire(import.meta.url);
  const sessionPath = require.resolve("../api-session");
  const prismaPath = require.resolve("../prisma");
  const originals = [require.cache[sessionPath], require.cache[prismaPath]];
  const calls: unknown[][] = [];
  const session = { storeId: "store-b", userId: "operator", role: "MANAGER" };
  require.cache[sessionPath] = {
    id: sessionPath, filename: sessionPath, loaded: true,
    exports: { getApiSession: async () => session },
  } as NodeJS.Module;
  require.cache[prismaPath] = {
    id: prismaPath, filename: prismaPath, loaded: true,
    exports: { prisma: {
      $executeRawUnsafe: async (...args: unknown[]) => { calls.push(args); return 1; },
      $queryRawUnsafe: async (...args: unknown[]) => { calls.push(args); return []; },
    } },
  } as NodeJS.Module;
  context.after(() => {
    for (const [index, path] of [sessionPath, prismaPath].entries()) {
      if (originals[index]) require.cache[path] = originals[index];
      else delete require.cache[path];
    }
  });
  const { POST: scan } = await import("../../app/api/packs/check-serial/route");
  const { GET, POST } = await import("../../app/api/pos/reconciliation/route");
  const post = (path: string, body: unknown) => new NextRequest(`http://localhost${path}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const conflict = {
    expectedStoreId: "store-a", queueId: "queue-a", terminalId: "POS-01",
    barcode: "12341234567001", reason: "Unexpected ticket", attempts: 1,
  };
  for (const response of [
    await scan(post("/api/packs/check-serial", { serialNumber: conflict.barcode, liveScan: true, expectedStoreId: "store-a" })),
    await POST(post("/api/pos/reconciliation", conflict)),
    await GET(new NextRequest("http://localhost/api/pos/reconciliation?terminalId=POS-01&expectedStoreId=store-a")),
  ]) {
    assert.equal(response.status, 409);
    assert.equal((await response.json()).code, "STORE_CHANGED");
  }
  assert.deepEqual(calls, []);

  const accepted = await POST(post("/api/pos/reconciliation", { ...conflict, expectedStoreId: "store-b" }));
  assert.equal(accepted.status, 200);
  assert.equal(calls.at(-1)?.[2], "store-b");
  calls.length = 0;
  const decisions = await GET(new NextRequest("http://localhost/api/pos/reconciliation?terminalId=POS-01&expectedStoreId=store-b"));
  assert.equal(decisions.status, 200);
  assert.equal(calls.at(-1)?.[1], "store-b");
  assert.equal(calls.at(-1)?.[2], "POS-01");
});
