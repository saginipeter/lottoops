import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { NextRequest } from "next/server";

test("pack activation endpoints require MANAGE_BACKSTOCK before touching inventory", async (context) => {
  const require = createRequire(import.meta.url);
  const paths = ["../api-session", "../prisma"].map((path) => require.resolve(path));
  const originals = paths.map((path) => require.cache[path]);
  let session: { userId: string; storeId: string; name: string; role: string; grantedPermissions?: string[] } | null = null;
  let databaseCalls = 0;
  const fakePrisma = {
    displaySlot: { findFirst: async () => { databaseCalls++; return null; } },
    pack: { findFirst: async () => { databaseCalls++; return null; } },
    $transaction: async () => { databaseCalls++; return {}; },
  };
  require.cache[paths[0]] = { id: paths[0], filename: paths[0], loaded: true, exports: { getApiSession: async () => session } } as NodeJS.Module;
  require.cache[paths[1]] = { id: paths[1], filename: paths[1], loaded: true, exports: { prisma: fakePrisma } } as NodeJS.Module;
  context.after(() => paths.forEach((path, index) => {
    if (originals[index]) require.cache[path] = originals[index];
    else delete require.cache[path];
  }));

  const [{ POST: autoFill }, { POST: activatePack }, { POST: activateSlot }] = await Promise.all([
    import("../../app/api/display-slots/auto-fill/route"),
    import("../../app/api/activate-pack/route"),
    import("../../app/api/slots/activate/route"),
  ]);
  const request = (url: string, body: Record<string, unknown>) => new NextRequest(`http://localhost${url}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const requests = [
    () => autoFill(request("/api/display-slots/auto-fill", { slotId: "slot" })),
    () => activatePack(request("/api/activate-pack", { packId: "pack", slotId: "slot" })),
    () => activateSlot(request("/api/slots/activate", { slotNumber: "01", packId: "pack", startingTicketNumber: 1 })),
  ];

  for (const role of ["AUDITOR", "EMPLOYEE", "SHIFT_LEAD"]) {
    session = { userId: "user", storeId: "store", name: role, role, grantedPermissions: [] };
    databaseCalls = 0;
    for (const call of requests) assert.equal((await call()).status, 403, `${role} must not activate stock`);
    assert.equal(databaseCalls, 0, `${role} is rejected before inventory access`);
  }

  session = { userId: "lead", storeId: "store", name: "Shift Lead", role: "SHIFT_LEAD", grantedPermissions: ["MANAGE_DISPLAY"] };
  databaseCalls = 0;
  for (const call of requests) assert.equal((await call()).status, 403, "MANAGE_DISPLAY does not grant back-stock activation");
  assert.equal(databaseCalls, 0);

  session.grantedPermissions = ["MANAGE_BACKSTOCK"];
  assert.notEqual((await requests[0]()).status, 403);
  assert.notEqual((await requests[1]()).status, 403);
  assert.notEqual((await requests[2]()).status, 403);
});
