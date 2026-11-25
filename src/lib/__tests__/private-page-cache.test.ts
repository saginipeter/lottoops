import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { proxy } from "../../proxy";
import { MFA_CHALLENGE_COOKIE, PLATFORM_SESSION_BACKUP_COOKIE, SESSION_COOKIE, signSession, type SessionPayload } from "../session";

const session: SessionPayload = {
  userId: "operator",
  storeId: "store-1",
  storeName: "Store",
  name: "Operator",
  email: "operator@example.test",
  role: "MANAGER",
  grantedPermissions: [],
};

test("authenticated proxy responses request private no-store handling", async () => {
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "private-page-cache-test-only-secret";
  try {
    const token = await signSession(session);
    const response = await proxy(new NextRequest("https://lottoops.test/pos", {
      headers: { cookie: `${SESSION_COOKIE}=${token}` },
    }));
    assert.equal(response.headers.get("cache-control"), "private, no-store, max-age=0, must-revalidate");
    assert.equal(response.headers.get("pragma"), "no-cache");
    const apiResponse = await proxy(new NextRequest("https://lottoops.test/api/packs/check-serial", {
      headers: { cookie: `${SESSION_COOKIE}=${token}` },
    }));
    assert.equal(apiResponse.headers.get("cache-control"), "private, no-store, max-age=0, must-revalidate");
    assert.equal(apiResponse.headers.get("pragma"), "no-cache");
  } finally {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  }
});

test("public login and kiosk responses are not reusable from a shared cache", async () => {
  for (const path of ["/login", "/tv-display", "/api/auth/login"]) {
    const response = await proxy(new NextRequest(`https://lottoops.test${path}`));
    assert.equal(response.headers.get("cache-control"), "private, no-store, max-age=0, must-revalidate", path);
    assert.equal(response.headers.get("pragma"), "no-cache", path);
  }
});

test("protected redirects cannot be restored from cache and invalid session cookies are deleted", async () => {
  const anonymous = await proxy(new NextRequest("https://lottoops.test/pos"));
  assert.equal(anonymous.headers.get("cache-control"), "private, no-store, max-age=0, must-revalidate");
  assert.equal(anonymous.headers.get("pragma"), "no-cache");

  const invalid = await proxy(new NextRequest("https://lottoops.test/pos", {
    headers: { cookie: `${SESSION_COOKIE}=invalid-token` },
  }));
  assert.equal(invalid.headers.get("cache-control"), "private, no-store, max-age=0, must-revalidate");
  const expiredCookies = invalid.headers.getSetCookie();
  for (const name of [SESSION_COOKIE, MFA_CHALLENGE_COOKIE, PLATFORM_SESSION_BACKUP_COOKIE]) {
    assert.ok(expiredCookies.some((cookie) => cookie.startsWith(`${name}=`) && /Max-Age=0/i.test(cookie)), `${name} should expire on an invalid session`);
  }
});

test("Auditor accounts are redirected to read-only reports instead of operational shift management", async () => {
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "private-page-cache-test-only-secret";
  try {
    const token = await signSession({ ...session, role: "AUDITOR" });
    const response = await proxy(new NextRequest("https://lottoops.test/shifts", {
      headers: { cookie: `${SESSION_COOKIE}=${token}` },
    }));
    assert.equal(response.status, 307);
    assert.equal(response.headers.get("location"), "https://lottoops.test/reports");
    assert.equal(response.headers.get("cache-control"), "private, no-store, max-age=0, must-revalidate");
  } finally {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  }
});
