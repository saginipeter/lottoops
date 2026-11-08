import assert from "node:assert/strict";
import { test } from "node:test";
import { decodeJwt } from "jose";
import {
  REMEMBERED_SESSION_MAX_AGE_SECONDS,
  SESSION_MAX_AGE_SECONDS,
  signMfaChallenge,
  signSession,
  verifyMfaChallenge,
  verifySession,
  type SessionPayload,
} from "../session";

const session: SessionPayload = {
  userId: "user",
  storeId: "store",
  storeName: "Store",
  name: "Cashier",
  email: "cashier@example.test",
  role: "EMPLOYEE",
  grantedPermissions: [],
};

const previousSecret = process.env.JWT_SECRET;
process.env.JWT_SECRET = "session-persistence-test-secret";

test.after(() => {
  if (previousSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = previousSecret;
});

test("remembered sessions expire in 30 days while normal sessions remain 8 hours", async () => {
  const standard = decodeJwt(await signSession(session));
  const remembered = decodeJwt(await signSession({ ...session, rememberMe: true }));
  assert.equal((standard.exp ?? 0) - (standard.iat ?? 0), SESSION_MAX_AGE_SECONDS);
  assert.equal((remembered.exp ?? 0) - (remembered.iat ?? 0), REMEMBERED_SESSION_MAX_AGE_SECONDS);
  assert.equal((await verifySession(await signSession({ ...session, rememberMe: true })))?.rememberMe, true);
});

test("the keep-logged-in choice survives the MFA challenge", async () => {
  const challenge = await verifyMfaChallenge(await signMfaChallenge("user", true));
  assert.deepEqual(challenge, { userId: "user", rememberMe: true });
});

test("the employee's selected numbered shift survives MFA and remains in the session", async () => {
  const assignment = { shiftId: "open-shift-2", shiftNumber: 2 as const };
  const challenge = await verifyMfaChallenge(await signMfaChallenge("user", false, assignment));
  assert.deepEqual(challenge, { userId: "user", rememberMe: false, ...assignment });
  const verified = await verifySession(await signSession({ ...session, ...assignment }));
  assert.equal(verified?.shiftId, assignment.shiftId);
  assert.equal(verified?.shiftNumber, assignment.shiftNumber);
});

test("invalid shift claims cannot be accepted from an MFA token", async () => {
  const token = await signMfaChallenge("user", false, { shiftId: "open-shift-2", shiftNumber: 2 });
  assert.equal((await verifyMfaChallenge(token))?.shiftNumber, 2);
});
