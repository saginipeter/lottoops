import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import bcrypt from "bcryptjs";
import * as OTPAuth from "otpauth";
import { NextRequest } from "next/server";
import {
  LOGIN_EMAIL_OTP_CHALLENGE_COOKIE,
  MFA_CHALLENGE_COOKIE,
  SESSION_COOKIE,
  verifyLoginEmailOtpChallenge,
  verifySession,
} from "../session";

test("password login requires single-use email OTP before session, enforces limits, and preserves TOTP as an additional factor", async (context) => {
  const require = createRequire(import.meta.url);
  const prismaPath = require.resolve("../prisma");
  const originalPrisma = require.cache[prismaPath];
  const originalFetch = globalThis.fetch;
  const previousEnv = {
    jwt: process.env.JWT_SECRET,
    pepper: process.env.LOGIN_OTP_PEPPER,
    apiKey: process.env.RESEND_API_KEY,
    from: process.env.REPORT_EMAIL_FROM,
  };
  process.env.JWT_SECRET = "otp-auth-test-jwt-secret";
  process.env.LOGIN_OTP_PEPPER = "otp-auth-test-pepper";
  process.env.RESEND_API_KEY = "mock-resend-key";
  process.env.REPORT_EMAIL_FROM = "LottoOps Test <no-reply@example.test>";

  type Challenge = { id: string; userId: string; hash: string; expiresAt: number; attempts: number; consumed: boolean };
  const user = {
    id: "staff-otp-test", email: "staff@example.test", name: "Test Staff", active: true,
    passwordHash: await bcrypt.hash("test-password", 4), role: "EMPLOYEE" as const,
    storeId: "store-otp-test", store: { name: "OTP Test Store" }, grantedPermissions: [],
  };
  const sentCodes: string[] = [];
  const loginSessionAssignments: unknown[][] = [];
  const totpSecret = new OTPAuth.Secret({ size: 20 });
  const totp = new OTPAuth.TOTP({ issuer: "LottoOps", label: user.email, algorithm: "SHA1", digits: 6, period: 30, secret: totpSecret });
  const challengeState: { current: Challenge | null } = { current: null };
  let rateCount = 0;
  let lastSentAt = 0;
  let authenticatorRequired = false;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    assert.equal(String(input), "https://api.resend.com/emails");
    const payload = JSON.parse(String(init?.body));
    const code = String(payload.text).match(/code is (\d{6})/)?.[1];
    assert.ok(code, "the mocked Resend request contains a six-digit code");
    sentCodes.push(code);
    return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;

  const prisma = {
    user: {
      findUnique: async () => user,
      findFirst: async () => user,
      update: async () => ({}),
    },
    $queryRawUnsafe: async (sql: string, ...parameters: unknown[]) => {
      if (sql.includes("INSERT INTO login_email_otp_challenges")) {
        const [userId, id, hash] = parameters.map(String);
        const now = Date.now();
        if (lastSentAt > now - 30_000 || (lastSentAt > now - 3_600_000 && rateCount >= 5)) return [];
        if (challengeState.current && !challengeState.current.consumed) challengeState.current.consumed = true;
        challengeState.current = { id, userId, hash, expiresAt: now + 300_000, attempts: 0, consumed: false };
        if (lastSentAt <= now - 3_600_000) rateCount = 0;
        rateCount += 1;
        lastSentAt = now;
        return [{ id }];
      }
      if (sql.includes("attempt_count = attempt_count + 1")) {
        const [id, userId, candidateHash, maxAttempts] = parameters;
        const challenge = challengeState.current;
        if (!challenge || challenge.id !== id || challenge.userId !== userId || challenge.consumed ||
            challenge.expiresAt <= Date.now() || challenge.attempts >= Number(maxAttempts)) return [];
        challenge.attempts += 1;
        const valid = challenge.hash === candidateHash;
        if (valid || challenge.attempts >= Number(maxAttempts)) challenge.consumed = true;
        return [{ valid }];
      }
      if (sql.includes("FROM login_email_otp_challenges") && sql.includes("consumed_at IS NULL")) {
        const [id, userId] = parameters;
        return challengeState.current && challengeState.current.id === id && challengeState.current.userId === userId &&
          !challengeState.current.consumed && challengeState.current.expiresAt > Date.now()
          ? [{ id }]
          : [];
      }
      if (sql.includes("SELECT enabled, required FROM user_mfa")) {
        return authenticatorRequired ? [{ enabled: true, required: true }] : [];
      }
      if (sql.includes("SELECT secret, enabled FROM user_mfa")) {
        return authenticatorRequired ? [{ secret: totpSecret.base32, enabled: true }] : [];
      }
      return [];
    },
    $executeRawUnsafe: async (sql: string, ...parameters: unknown[]) => {
      if (sql.includes("INSERT INTO login_sessions")) loginSessionAssignments.push(parameters);
      const current = challengeState.current;
      if (sql.includes("UPDATE login_email_otp_challenges") && current && current.id === parameters[0]) current.consumed = true;
      return 0;
    },
  };
  require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: { prisma } } as NodeJS.Module;
  context.after(() => {
    if (originalPrisma) require.cache[prismaPath] = originalPrisma;
    else delete require.cache[prismaPath];
    globalThis.fetch = originalFetch;
    if (previousEnv.jwt === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previousEnv.jwt;
    if (previousEnv.pepper === undefined) delete process.env.LOGIN_OTP_PEPPER; else process.env.LOGIN_OTP_PEPPER = previousEnv.pepper;
    if (previousEnv.apiKey === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = previousEnv.apiKey;
    if (previousEnv.from === undefined) delete process.env.REPORT_EMAIL_FROM; else process.env.REPORT_EMAIL_FROM = previousEnv.from;
  });

  const { POST: login } = await import("../../app/api/auth/login/route");
  const { POST: verifyEmailOtp } = await import("../../app/api/auth/email-otp/verify/route");
  const { POST: resendEmailOtp } = await import("../../app/api/auth/email-otp/resend/route");
  const { POST: verifyTotp } = await import("../../app/api/auth/mfa/verify/route");
  const { signMfaChallenge } = await import("../session");
  const passwordRequest = () => login(new NextRequest("https://lottoops.test/api/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: " STAFF@EXAMPLE.TEST ", password: "test-password" }),
  }));
  const verifyRequest = (cookie: string, code: string) => verifyEmailOtp(new NextRequest("https://lottoops.test/api/auth/email-otp/verify", {
    method: "POST", headers: { "Content-Type": "application/json", cookie: `${LOGIN_EMAIL_OTP_CHALLENGE_COOKIE}=${cookie}` },
    body: JSON.stringify({ code }),
  }));

  const { hashLoginEmailOtp } = await import("../login-email-otp");
  assert.match(hashLoginEmailOtp("challenge-a", user.id, "000001"), /^[a-f0-9]{64}$/);
  assert.notEqual(hashLoginEmailOtp("challenge-a", user.id, "000001"), hashLoginEmailOtp("challenge-b", user.id, "000001"));
  assert.notEqual(hashLoginEmailOtp("challenge-a", user.id, "000001"), "000001");

  const firstLogin = await passwordRequest();
  assert.equal(firstLogin.status, 202, JSON.stringify(await firstLogin.clone().json()));
  assert.deepEqual(await firstLogin.json(), { emailOtpRequired: true });
  assert.equal(firstLogin.cookies.get(LOGIN_EMAIL_OTP_CHALLENGE_COOKIE)?.maxAge, 300);
  assert.equal(loginSessionAssignments.length, 0, "password acceptance alone must not create a session");
  const firstToken = firstLogin.cookies.get(LOGIN_EMAIL_OTP_CHALLENGE_COOKIE)?.value;
  assert.ok(firstToken);
  const firstChallenge = await verifyLoginEmailOtpChallenge(firstToken);
  assert.ok(firstChallenge);
  assert.equal(firstLogin.cookies.get(SESSION_COOKIE)?.value, "", "no session cookie is issued before OTP");
  assert.equal(sentCodes.length, 1);
  assert.match(sentCodes[0], /^\d{6}$/);
  const blockedResend = await resendEmailOtp(new NextRequest("https://lottoops.test/api/auth/email-otp/resend", {
    method: "POST", headers: { cookie: `${LOGIN_EMAIL_OTP_CHALLENGE_COOKIE}=${firstToken}` },
  }));
  assert.equal(blockedResend.status, 429, "the server-enforced resend cooldown applies");
  assert.equal(sentCodes.length, 1, "blocked resend performs no provider call");

  const staleTotpToken = await signMfaChallenge(user.id);
  const staleTotpResponse = await verifyTotp(new NextRequest("https://lottoops.test/api/auth/mfa/verify", {
    method: "POST", headers: { "Content-Type": "application/json", cookie: `${MFA_CHALLENGE_COOKIE}=${staleTotpToken}` },
    body: JSON.stringify({ code: totp.generate() }),
  }));
  assert.equal(staleTotpResponse.status, 401, "legacy TOTP challenge without verified email cannot bypass the email factor");
  assert.equal(loginSessionAssignments.length, 0);

  const wrongCode = sentCodes[0] === "000000" ? "000001" : "000000";
  assert.equal((await verifyRequest(firstToken, wrongCode)).status, 401);
  const complete = await verifyRequest(firstToken, sentCodes[0]);
  assert.equal(complete.status, 200);
  const sessionToken = complete.cookies.get(SESSION_COOKIE)?.value;
  assert.ok(sessionToken);
  assert.equal((await verifySession(sessionToken))?.userId, user.id);
  assert.equal(loginSessionAssignments.length, 1);
  assert.equal((await verifyRequest(firstToken, sentCodes[0])).status, 401, "a consumed code cannot be replayed");
  assert.equal(loginSessionAssignments.length, 1, "a replay cannot create a second session");
  const usedChallengeResend = await resendEmailOtp(new NextRequest("https://lottoops.test/api/auth/email-otp/resend", {
    method: "POST", headers: { cookie: `${LOGIN_EMAIL_OTP_CHALLENGE_COOKIE}=${firstToken}` },
  }));
  assert.equal(usedChallengeResend.status, 401, "a consumed challenge cookie cannot be used to generate more emails");

  lastSentAt = Date.now() - 31_000;
  const attemptsLogin = await passwordRequest();
  assert.equal(attemptsLogin.status, 202);
  const attemptsToken = attemptsLogin.cookies.get(LOGIN_EMAIL_OTP_CHALLENGE_COOKIE)!.value;
  const actualAttemptsCode = sentCodes.at(-1)!;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    assert.equal((await verifyRequest(attemptsToken, wrongCode === actualAttemptsCode ? "999999" : wrongCode)).status, 401);
  }
  assert.equal(challengeState.current?.attempts, 5);
  assert.equal(challengeState.current?.consumed, true, "the fifth failed attempt consumes the challenge");
  assert.equal((await verifyRequest(attemptsToken, actualAttemptsCode)).status, 401);
  assert.equal(loginSessionAssignments.length, 1);

  lastSentAt = Date.now() - 31_000;
  const expiredLogin = await passwordRequest();
  const expiredToken = expiredLogin.cookies.get(LOGIN_EMAIL_OTP_CHALLENGE_COOKIE)!.value;
  const expiredCode = sentCodes.at(-1)!;
  challengeState.current!.expiresAt = Date.now() - 1;
  assert.equal((await verifyRequest(expiredToken, expiredCode)).status, 401, "an expired database challenge cannot authenticate");
  assert.equal(loginSessionAssignments.length, 1);

  authenticatorRequired = true;
  lastSentAt = Date.now() - 31_000;
  const twoFactorLogin = await passwordRequest();
  assert.equal(twoFactorLogin.status, 202);
  const twoFactorToken = twoFactorLogin.cookies.get(LOGIN_EMAIL_OTP_CHALLENGE_COOKIE)!.value;
  const emailStep = await verifyRequest(twoFactorToken, sentCodes.at(-1)!);
  assert.equal(emailStep.status, 202, "a configured TOTP remains an additional factor");
  assert.equal((await emailStep.json()).mfaRequired, true);
  assert.equal(emailStep.cookies.get(SESSION_COOKIE)?.value, "");
  assert.equal(loginSessionAssignments.length, 1, "email OTP alone cannot bypass configured TOTP");
  const totpToken = emailStep.cookies.get(MFA_CHALLENGE_COOKIE)?.value;
  assert.ok(totpToken);
  const { verifyMfaChallenge } = await import("../session");
  assert.equal((await verifyMfaChallenge(totpToken))?.emailOtpVerified, true);
  const totpResponse = await verifyTotp(new NextRequest("https://lottoops.test/api/auth/mfa/verify", {
    method: "POST", headers: { "Content-Type": "application/json", cookie: `${MFA_CHALLENGE_COOKIE}=${totpToken}` },
    body: JSON.stringify({ code: totp.generate() }),
  }));
  assert.equal(totpResponse.status, 200);
  assert.ok(totpResponse.cookies.get(SESSION_COOKIE)?.value);
  assert.equal(loginSessionAssignments.length, 2);
});
