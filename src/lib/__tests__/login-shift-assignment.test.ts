import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import bcrypt from "bcryptjs";
import * as OTPAuth from "otpauth";
import { NextRequest } from "next/server";
import { MFA_CHALLENGE_COOKIE, SESSION_COOKIE, verifyMfaChallenge, verifySession } from "../session";

test("password login has no email OTP dependency and never restores a previous shift", async (context) => {
  const require = createRequire(import.meta.url);
  const prismaPath = require.resolve("../prisma");
  const originalPrisma = require.cache[prismaPath];
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "password-login-shift-test-secret";

  let role: "EMPLOYEE" | "SHIFT_LEAD" | "MANAGER" = "EMPLOYEE";
  let authenticatorRequired = false;
  const loginSessionAssignments: unknown[][] = [];
  const endedSessionIds: unknown[] = [];
  const passwordHash = await bcrypt.hash("test-password", 4);
  const authenticatorSecret = new OTPAuth.Secret({ size: 20 });
  const authenticator = new OTPAuth.TOTP({
    issuer: "LottoOps",
    label: "staff@example.test",
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: authenticatorSecret,
  });
  const prisma = {
    user: {
      findUnique: async () => ({
        id: "staff-1", email: "staff@example.test", name: "Test Staff", active: true,
        passwordHash, role, storeId: "store-1", store: { name: "Test Store" }, grantedPermissions: [],
      }),
      findFirst: async () => ({
        id: "staff-1", email: "staff@example.test", name: "Test Staff", active: true,
        role, storeId: "store-1", store: { name: "Test Store" }, grantedPermissions: [],
      }),
      update: async () => ({}),
    },
    $executeRawUnsafe: async (sql: string, ...parameters: unknown[]) => {
      if (sql.includes("INSERT INTO login_sessions")) loginSessionAssignments.push(parameters);
      if (sql.includes("UPDATE login_sessions")) endedSessionIds.push(parameters[0]);
      return 0;
    },
    $queryRawUnsafe: async (sql: string) => {
      if (sql.includes("SELECT enabled, required FROM user_mfa")) {
        return authenticatorRequired ? [{ enabled: true, required: true }] : [];
      }
      if (sql.includes("SELECT secret, enabled FROM user_mfa")) {
        return authenticatorRequired ? [{ secret: authenticatorSecret.base32, enabled: true }] : [];
      }
      return [];
    },
  };
  require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: { prisma } } as NodeJS.Module;
  context.after(() => {
    if (originalPrisma) require.cache[prismaPath] = originalPrisma;
    else delete require.cache[prismaPath];
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });

  const { POST: login } = await import("../../app/api/auth/login/route");
  const doLogin = (body: Record<string, unknown> = {}, cookie?: string) => login(new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify({ email: " Staff@Example.Test ", password: "test-password", ...body }),
  }));

  for (const userRole of ["EMPLOYEE", "SHIFT_LEAD", "MANAGER"] as const) {
    role = userRole;
    const response = await doLogin();
    assert.equal(response.status, 200, `${userRole} can sign in without email delivery configuration`);
    const payload = await response.json();
    assert.equal(payload.user.role, userRole);
    assert.equal(payload.user.shiftNumber, null);
    assert.equal(payload.user.terminalId, null);
    assert.equal(payload.user.needsShiftSelection, userRole === "EMPLOYEE" || userRole === "SHIFT_LEAD");
    assert.equal(response.cookies.get(MFA_CHALLENGE_COOKIE)?.value, "");
    assert.ok(response.cookies.get(SESSION_COOKIE)?.value);
    assert.ok(response.cookies.getAll().every((cookie) => !cookie.name.toLowerCase().includes("otp")));
    const session = await verifySession(response.cookies.get(SESSION_COOKIE)!.value);
    assert.equal(session?.role, userRole);
    assert.equal(session?.shiftId, undefined, "a historical shift is never restored on login");
    assert.equal(session?.shiftNumber, undefined);
    assert.equal(session?.terminalId, undefined);
    assert.deepEqual(loginSessionAssignments.at(-1)?.slice(1), ["store-1", "staff-1", null, null]);
  }

  const { signSession } = await import("../session");
  const oldSession = await signSession({
    userId: "prior-user", storeId: "store-1", storeName: "Test Store", name: "Prior User",
    email: "prior@example.test", role: "MANAGER", grantedPermissions: [], loginSessionId: "old-session",
  });
  const nextLogin = await doLogin({}, `${SESSION_COOKIE}=${oldSession}`);
  assert.equal(nextLogin.status, 200);
  assert.ok(endedSessionIds.includes("old-session"), "the previous operator login session is ended");

  authenticatorRequired = true;
  const mfaLogin = await doLogin({ rememberMe: true });
  assert.equal(mfaLogin.status, 202);
  assert.deepEqual(await mfaLogin.json(), { mfaRequired: true });
  assert.equal(mfaLogin.cookies.get(SESSION_COOKIE)?.value, "");
  const mfaToken = mfaLogin.cookies.get(MFA_CHALLENGE_COOKIE)?.value;
  assert.ok(mfaToken);
  assert.deepEqual(await verifyMfaChallenge(mfaToken), { userId: "staff-1", rememberMe: true });
  assert.equal(loginSessionAssignments.length, 4, "the MFA challenge does not create a session until the code is checked");

  const { POST: verifyMfa } = await import("../../app/api/auth/mfa/verify/route");
  const verified = await verifyMfa(new NextRequest("http://localhost/api/auth/mfa/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: `${MFA_CHALLENGE_COOKIE}=${mfaToken}` },
    body: JSON.stringify({ code: authenticator.generate() }),
  }));
  assert.equal(verified.status, 200);
  const mfaSessionToken = verified.cookies.get(SESSION_COOKIE)?.value;
  assert.ok(mfaSessionToken);
  const mfaSession = await verifySession(mfaSessionToken);
  assert.equal(mfaSession?.rememberMe, true);
  assert.equal(mfaSession?.shiftId, undefined);
  assert.deepEqual(loginSessionAssignments.at(-1)?.slice(1), ["store-1", "staff-1", null, null]);
});
