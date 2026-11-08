import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { NextRequest } from "next/server";

test("Auditors cannot begin or complete operational physical audits", async (context) => {
  const require = createRequire(import.meta.url);
  const sessionPath = require.resolve("../api-session");
  const prismaPath = require.resolve("../prisma");
  const originals = [require.cache[sessionPath], require.cache[prismaPath]];
  let reads = 0;
  let writes = 0;
  const session = { userId: "auditor", storeId: "store", name: "Auditor", role: "AUDITOR" };
  const forbiddenPrisma = new Proxy({}, { get: () => () => { reads += 1; writes += 1; throw new Error("Auditor request must be rejected before database access."); } });
  require.cache[sessionPath] = { id: sessionPath, filename: sessionPath, loaded: true, exports: { getApiSession: async () => session } } as NodeJS.Module;
  require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: { prisma: forbiddenPrisma } } as NodeJS.Module;
  context.after(() => {
    for (const [index, path] of [sessionPath, prismaPath].entries()) {
      if (originals[index]) require.cache[path] = originals[index];
      else delete require.cache[path];
    }
  });

  const { POST: begin } = await import("../../app/api/inventory-audits/begin/route");
  const { POST: end } = await import("../../app/api/inventory-audits/end/route");
  const beginResponse = await begin(new NextRequest("http://localhost/api/inventory-audits/begin", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ shiftId: "shift" }),
  }));
  const endResponse = await end(new NextRequest("http://localhost/api/inventory-audits/end", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ auditId: "audit" }),
  }));
  assert.equal(beginResponse.status, 403);
  assert.equal(endResponse.status, 403);
  assert.equal(reads + writes, 0, "Auditor requests are denied before audit/database access");
});
