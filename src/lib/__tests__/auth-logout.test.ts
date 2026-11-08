import assert from "node:assert/strict";
import test from "node:test";
import { MFA_CHALLENGE_COOKIE, PLATFORM_SESSION_BACKUP_COOKIE, SESSION_COOKIE } from "../session";
import { POST } from "../../app/api/auth/logout/route";

test("logout expires every LottoOps authentication cookie and forbids cached logout responses", async () => {
  const response = await POST();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store, max-age=0");
  const cookies = response.cookies.getAll();
  for (const name of [SESSION_COOKIE, MFA_CHALLENGE_COOKIE, PLATFORM_SESSION_BACKUP_COOKIE]) {
    const cookie = cookies.find((item) => item.name === name);
    assert.ok(cookie, `${name} should be explicitly cleared`);
    assert.equal(cookie.value, "");
    assert.equal(cookie.maxAge, 0);
    assert.equal(cookie.path, "/");
    assert.equal(cookie.httpOnly, true);
    assert.equal(cookie.sameSite, "lax");
  }
});
