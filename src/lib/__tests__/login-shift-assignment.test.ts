import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import {
  LOGIN_EMAIL_OTP_CHALLENGE_COOKIE,
  MFA_CHALLENGE_COOKIE,
  PLATFORM_SESSION_BACKUP_COOKIE,
  SESSION_COOKIE,
  verifyLoginEmailOtpChallenge,
  verifySession,
} from "../session";

test("every role requires email OTP before a session and shift selection is not auto-restored", async (context) => {
  const require = createRequire(import.meta.url);
  const prismaPath = require.resolve("../prisma");
  const originalPrisma = require.cache[prismaPath];
  const originalFetch = globalThis.fetch;
  const priorEnv = {
    jwt: process.env.JWT_SECRET,
    pepper: process.env.LOGIN_OTP_PEPPER,
    resend: process.env.RESEND_API_KEY,
    from: process.env.REPORT_EMAIL_FROM,
  };
  process.env.JWT_SECRET = "login-otp-shift-test-secret";
  process.env.LOGIN_OTP_PEPPER = "login-otp-shift-test-pepper";
  process.env.RESEND_API_KEY = "mock-resend-key";
  process.env.REPORT_EMAIL_FROM = "LottoOps Test <no-reply@example.test>";

  let role: "EMPLOYEE" | "SHIFT_LEAD" | "MANAGER" = "EMPLOYEE";
  let challenge: { id: string; userId: string; hash: string; expiresAt: number; attempts: number; consumed: boolean } | null = null;
  const deliveredCodes: string[] = [];
  const loginSessionAssignments: unknown[][] = [];
  const passwordHash = await bcrypt.hash("test-password", 4);
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
      return 0;
    },
    $queryRawUnsafe: async (sql: string, ...parameters: unknown[]) => {
      if (sql.includes("INSERT INTO login_email_otp_challenges")) {
        const [userId, id, hash] = parameters.map(String);
        challenge = { userId, id, hash, expiresAt: Date.now() + 300_000, attempts: 0, consumed: false };
        return [{ id }];
      }
      if (sql.includes("attempt_count = attempt_count + 1")) {
        const [id, userId, hash, maxAttempts] = parameters;
        const current = challenge;
        if (!current || current.id !== id || current.userId !== userId || current.consumed || current.expiresAt <= Date.now() || current.attempts >= Number(maxAttempts)) return [];
        current.attempts += 1;
        const valid = current.hash === hash;
        if (valid || current.attempts >= Number(maxAttempts)) current.consumed = true;
        return [{ valid }];
      }
      if (sql.includes("SELECT enabled, required FROM user_mfa")) return [];
      return [];
    },
  };
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    assert.equal(String(input), "https://api.resend.com/emails");
    const body = JSON.parse(String(init?.body));
    const code = String(body.text).match(/code is (\d{6})/)?.[1];
    assert.ok(code);
    deliveredCodes.push(code);
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
  require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: { prisma } } as NodeJS.Module;
  context.after(() => {
    if (originalPrisma) require.cache[prismaPath] = originalPrisma;
    else delete require.cache[prismaPath];
    globalThis.fetch = originalFetch;
    if (priorEnv.jwt === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = priorEnv.jwt;
    if (priorEnv.pepper === undefined) delete process.env.LOGIN_OTP_PEPPER; else process.env.LOGIN_OTP_PEPPER = priorEnv.pepper;
    if (priorEnv.resend === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = priorEnv.resend;
    if (priorEnv.from === undefined) delete process.env.REPORT_EMAIL_FROM; else process.env.REPORT_EMAIL_FROM = priorEnv.from;
  });

  const { POST: login } = await import("../../app/api/auth/login/route");
  const { POST: verifyOtp } = await import("../../app/api/auth/email-otp/verify/route");
  const doLogin = (body: Record<string, unknown> = {}) => login(new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: " Staff@Example.Test ", password: "test-password", ...body }),
  }));

  for (const userRole of ["EMPLOYEE", "SHIFT_LEAD", "MANAGER"] as const) {
    role = userRole;
    const passwordAccepted = await doLogin();
    assert.equal(passwordAccepted.status, 202, `${userRole} password check must transition to OTP`);
    assert.deepEqual(await passwordAccepted.json(), { emailOtpRequired: true });
    assert.equal(passwordAccepted.cookies.get(LOGIN_EMAIL_OTP_CHALLENGE_COOKIE)?.maxAge, 300);
    assert.equal(passwordAccepted.cookies.get(SESSION_COOKIE)?.value, "", "password success cannot issue a session");
    assert.equal(passwordAccepted.cookies.get(MFA_CHALLENGE_COOKIE)?.maxAge, 0, "password success clears stale TOTP challenge");
    assert.equal(passwordAccepted.cookies.get(PLATFORM_SESSION_BACKUP_COOKIE)?.maxAge, 0, "password success clears stale platform session");
    assert.equal(loginSessionAssignments.length, userRole === "EMPLOYEE" ? 0 : userRole === "SHIFT_LEAD" ? 1 : 2,
      "the prior iteration's session should only exist after its OTP verification");
    const token = passwordAccepted.cookies.get(LOGIN_EMAIL_OTP_CHALLENGE_COOKIE)?.value;
    assert.ok(token);
    const signedChallenge = await verifyLoginEmailOtpChallenge(token);
    assert.deepEqual(signedChallenge && { userId: signedChallenge.userId, rememberMe: signedChallenge.rememberMe }, { userId: "staff-1", rememberMe: false });

    const code = deliveredCodes.at(-1)!;
    const wrongCode = code === "000000" ? "000001" : "000000";
    const invalid = await verifyOtp(new NextRequest("http://localhost/api/auth/email-otp/verify", {
      method: "POST", headers: { "Content-Type": "application/json", cookie: `${LOGIN_EMAIL_OTP_CHALLENGE_COOKIE}=${token}` },
      body: JSON.stringify({ code: wrongCode }),
    }));
    assert.equal(invalid.status, 401);
    assert.equal(loginSessionAssignments.length, userRole === "EMPLOYEE" ? 0 : userRole === "SHIFT_LEAD" ? 1 : 2,
      "an incorrect code cannot create a session");

    const verified = await verifyOtp(new NextRequest("http://localhost/api/auth/email-otp/verify", {
      method: "POST", headers: { "Content-Type": "application/json", cookie: `${LOGIN_EMAIL_OTP_CHALLENGE_COOKIE}=${token}` },
      body: JSON.stringify({ code }),
    }));
    assert.equal(verified.status, 200);
    const payload = await verified.json();
    assert.equal(payload.user.role, userRole);
    assert.equal(payload.user.shiftNumber, null);
    assert.equal(payload.user.terminalId, null);
    assert.equal(payload.user.needsShiftSelection, userRole === "EMPLOYEE" || userRole === "SHIFT_LEAD");
    const sessionToken = verified.cookies.get(SESSION_COOKIE)?.value;
    assert.ok(sessionToken);
    const session = await verifySession(sessionToken);
    assert.equal(session?.role, userRole);
    assert.equal(session?.shiftId, undefined, "a previous open shift is never auto-restored during authentication");
    assert.equal(session?.terminalId, undefined);
    assert.deepEqual(loginSessionAssignments.at(-1)?.slice(1), ["store-1", "staff-1", null, null]);
    const replay = await verifyOtp(new NextRequest("http://localhost/api/auth/email-otp/verify", {
      method: "POST", headers: { "Content-Type": "application/json", cookie: `${LOGIN_EMAIL_OTP_CHALLENGE_COOKIE}=${token}` },
      body: JSON.stringify({ code }),
    }));
    assert.equal(replay.status, 401, "email OTP is single-use");
  }
});
