import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { MFA_CHALLENGE_COOKIE, PLATFORM_SESSION_BACKUP_COOKIE, SESSION_COOKIE, verifyMfaChallenge, verifySession } from "../session";

test("staff authenticate before choosing a shift, including through MFA", async (context) => {
  const require = createRequire(import.meta.url);
  const prismaPath = require.resolve("../prisma");
  const originalPrisma = require.cache[prismaPath];
  const priorSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "login-shift-test-secret";

  let role: "EMPLOYEE" | "SHIFT_LEAD" | "MANAGER" = "EMPLOYEE";
  let mfaRequired = false;
  const passwordHash = await bcrypt.hash("test-password", 4);
  const prisma = {
    user: {
      findUnique: async () => ({
        id: "staff-1", email: "staff@example.test", name: "Test Staff", active: true,
        passwordHash, role, storeId: "store-1", store: { name: "Test Store" }, grantedPermissions: [],
      }),
      update: async () => ({}),
    },
    $executeRawUnsafe: async () => 0,
    $queryRawUnsafe: async () => mfaRequired ? [{ enabled: true, required: true }] : [],
  };
  require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: { prisma } } as NodeJS.Module;
  context.after(() => {
    if (originalPrisma) require.cache[prismaPath] = originalPrisma;
    else delete require.cache[prismaPath];
    if (priorSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = priorSecret;
  });

  const { POST } = await import("../../app/api/auth/login/route");
  const login = (body: Record<string, unknown>) => POST(new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: " Staff@Example.Test ", password: "test-password", ...body }),
  }));

  for (const staffRole of ["EMPLOYEE", "SHIFT_LEAD"] as const) {
    role = staffRole;
    const noSelection = await login({});
    assert.equal(noSelection.status, 200, `${staffRole} can authenticate before choosing a shift`);
    const unassignedPayload = await noSelection.json();
    assert.equal(unassignedPayload.user.needsShiftSelection, true);
    assert.equal(unassignedPayload.user.shiftNumber, null);
    const unassignedToken = noSelection.cookies.get(SESSION_COOKIE)?.value;
    assert.ok(unassignedToken);
    const unassignedSession = await verifySession(unassignedToken);
    assert.equal(unassignedSession?.shiftId, undefined);
    assert.ok(unassignedSession?.loginSessionId);

    const response = await login({ shiftId: "shift-2-T1" });
    assert.equal(response.status, 200);
    assert.equal(response.cookies.get(MFA_CHALLENGE_COOKIE)?.maxAge, 0, "direct login clears a stale MFA challenge");
    assert.equal(response.cookies.get(PLATFORM_SESSION_BACKUP_COOKIE)?.maxAge, 0, "direct login clears a stale platform-session backup");
    const responsePayload = await response.json();
    assert.equal(responsePayload.user.needsShiftSelection, true, "a password-login request cannot bypass terminal authorization by supplying a shift ID");
    assert.equal(responsePayload.user.shiftNumber, null);
    assert.equal(responsePayload.user.terminalId, null);
    const token = response.cookies.get(SESSION_COOKIE)?.value;
    assert.ok(token);
    const session = await verifySession(token);
    assert.equal(session?.shiftId, undefined);
    assert.equal(session?.shiftNumber, undefined);
    assert.equal(session?.terminalId, undefined);
    assert.ok(session?.loginSessionId);
  }

  role = "MANAGER";
  const managerResponse = await login({});
  assert.equal(managerResponse.status, 200, "manager login does not require shift selection");
  assert.equal((await managerResponse.json()).user.shiftNumber, null);
  const managerToken = managerResponse.cookies.get(SESSION_COOKIE)?.value;
  assert.ok(managerToken);
  assert.equal((await verifySession(managerToken))?.shiftId, undefined);

  role = "EMPLOYEE";
  mfaRequired = true;
  const mfaResponse = await login({});
  assert.equal(mfaResponse.status, 202);
  assert.equal(mfaResponse.cookies.get(SESSION_COOKIE)?.maxAge, 0, "MFA transition clears the previous signed-in account");
  assert.equal(mfaResponse.cookies.get(PLATFORM_SESSION_BACKUP_COOKIE)?.maxAge, 0, "MFA transition clears a stale platform-session backup");
  assert.equal(mfaResponse.cookies.get(MFA_CHALLENGE_COOKIE)?.maxAge, 300);
  const challenge = mfaResponse.cookies.get("lottoops_mfa_challenge")?.value;
  assert.ok(challenge);
  assert.deepEqual(await verifyMfaChallenge(challenge), {
    userId: "staff-1", rememberMe: false,
  });
});
