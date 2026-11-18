import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { proxy } from "../../proxy";
import { SESSION_COOKIE, signSession, type SessionPayload } from "../session";

async function requestFor(path: string, role: "EMPLOYEE" | "SHIFT_LEAD") {
  const payload: SessionPayload = {
    userId: `user-${role.toLowerCase()}`,
    storeId: "store-1",
    storeName: "Store 1",
    name: "Staff Member",
    email: "staff@example.test",
    role,
    grantedPermissions: [],
    shiftId: "shift-1",
    shiftNumber: 1,
    terminalId: "T1",
    loginSessionId: "login-1",
  };
  const token = await signSession(payload);
  return new NextRequest(`https://lottoops.test${path}`, {
    headers: { cookie: `${SESSION_COOKIE}=${token}` },
  });
}

test("employees and shift leads can open the shared Track Tickets routes", async (context) => {
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "employee-ticket-access-test-only-secret";
  context.after(() => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });

  for (const role of ["EMPLOYEE", "SHIFT_LEAD"] as const) {
    for (const path of ["/sales", "/pos"]) {
      const response = await proxy(await requestFor(path, role));
      assert.equal(response.status, 200, `${role} should be allowed to open ${path}`);
    }
    const restricted = await proxy(await requestFor("/inventory/returned", role));
    assert.equal(restricted.status, 307, `${role} should remain blocked from unrelated inventory correction routes`);
    assert.equal(restricted.headers.get("location"), "https://lottoops.test/shifts");
  }
});
