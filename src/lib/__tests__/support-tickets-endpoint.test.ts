import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { NextRequest } from "next/server";

test("support ticket history and message submission are restricted to owners and managers", async (context) => {
  const require = createRequire(import.meta.url);
  const paths = ["../api-session", "../prisma"].map((path) => require.resolve(path));
  const originals = paths.map((path) => require.cache[path]);
  let session: { userId: string; storeId: string; name: string; role: string; grantedPermissions: string[] } | null = {
    userId: "manager", storeId: "store", name: "Manager", role: "MANAGER", grantedPermissions: [],
  };
  require.cache[paths[0]!] = { id: paths[0]!, filename: paths[0]!, loaded: true, exports: { getApiSession: async () => session } } as NodeJS.Module;
  require.cache[paths[1]!] = { id: paths[1]!, filename: paths[1]!, loaded: true, exports: { prisma: null } } as NodeJS.Module;
  context.after(() => paths.forEach((path, index) => {
    if (originals[index]) require.cache[path] = originals[index];
    else delete require.cache[path];
  }));

  const { GET, POST } = await import("../../app/api/support-tickets/route");
  const request = () => new NextRequest("http://localhost/api/support-tickets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subject: "Scanner issue", description: "Game lookup did not load." }),
  });

  assert.equal((await GET()).status, 503, "manager can pass authorization and reaches the database availability check");
  assert.equal((await POST(request())).status, 503, "manager can submit and reaches the database availability check");

  for (const role of ["EMPLOYEE", "SHIFT_LEAD", "AUDITOR", "PLATFORM_ADMIN"]) {
    session = { userId: role.toLowerCase(), storeId: "store", name: role, role, grantedPermissions: [] };
    assert.equal((await GET()).status, 403, `${role} cannot read support history`);
    assert.equal((await POST(request())).status, 403, `${role} cannot submit support messages`);
  }

  session = null;
  assert.equal((await GET()).status, 401);
  assert.equal((await POST(request())).status, 401);
});
