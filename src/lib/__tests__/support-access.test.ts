import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import {
  approveSupportAccess, consumeSupportAccess, hashSupportToken, isSameOriginMutation,
  isSupportSessionAuthorized, isSupportToken, listSupportRequests, requestSupportAccess,
  revokeSupportAccess,
} from "@/lib/support-access";
import type { SessionPayload } from "@/lib/session";

const admin: SessionPayload = {
  userId: "admin", storeId: "platform", storeName: "Platform", name: "Admin",
  email: "admin@example.test", role: "PLATFORM_ADMIN", grantedPermissions: [],
};
const owner: SessionPayload = { ...admin, userId: "owner", storeId: "home-store", role: "OWNER" };
const support = { ...owner, storeId: "store", role: "MANAGER" as const, supportAccessId: "request", impersonatedBy: { userId: admin.userId, name: admin.name, email: admin.email } };
const token = "a".repeat(64);

function database(rows: unknown[] = []) {
  const queries: Array<{ sql: string; values: unknown[] }> = [];
  return {
    queries,
    async $executeRawUnsafe() {},
    async $queryRawUnsafe(sql: string, ...values: unknown[]) {
      queries.push({ sql, values });
      return rows;
    },
  };
}

function assertLiveChecks(sql: string) {
  assert.match(sql, /s\."ownerUserId" = r\.owner_user_id/);
  assert.doesNotMatch(sql, /owner\."?storeId"?/);
  assert.match(sql, /owner\.active = TRUE AND owner\.role = 'OWNER'/);
  assert.match(sql, /admin\.active = TRUE AND admin\.role = 'PLATFORM_ADMIN'/);
  assert.match(sql, /COALESCE\(c\.suspended, FALSE\) = FALSE/);
  assert.match(sql, /c\.updated_at <= r\.approved_at/);
  assert.match(sql, /rev\.user_id = r\.admin_user_id AND rev\.revoked_at >= r\.created_at/);
}

test("mutations require an exact same origin and reject missing/cross-site origins", () => {
  const request = (origin?: string, site = "same-origin") => new Request("https://lotto.example/api/support-access", {
    headers: { ...(origin ? { origin } : {}), "sec-fetch-site": site },
  });
  assert.equal(isSameOriginMutation(request("https://lotto.example")), true);
  assert.equal(isSameOriginMutation(request()), false);
  assert.equal(isSameOriginMutation(request("https://attacker.example")), false);
  assert.equal(isSameOriginMutation(request("https://lotto.example", "cross-site")), false);
});

test("tokens are 256-bit hex and hashed before storage", () => {
  assert.equal(isSupportToken(token), true);
  for (const value of [null, undefined, "", "a".repeat(63), "g".repeat(64), "a".repeat(65)]) assert.equal(isSupportToken(value), false);
  assert.match(hashSupportToken(token), /^[a-f0-9]{64}$/);
  assert.notEqual(hashSupportToken(token), token);
});

test("only a non-impersonated platform admin can request assistance", async () => {
  const db = database();
  await assert.rejects(requestSupportAccess(owner, "store", db), /Platform admin/);
  await assert.rejects(requestSupportAccess({ ...admin, impersonatedBy: support.impersonatedBy }, "store", db), /Platform admin/);
  assert.equal(db.queries.length, 0);
});

test("request issuance binds current actual owner, store, and active admin and blocks suspended stores", async () => {
  const db = database([{ id: "request" }]);
  await requestSupportAccess(admin, "store", db);
  const { sql, values } = db.queries[0];
  assert.match(sql, /owner\.id = s\."ownerUserId"/);
  assert.match(sql, /owner\.active = TRUE AND owner\.role = 'OWNER'/);
  assert.match(sql, /admin\.active = TRUE AND admin\.role = 'PLATFORM_ADMIN'/);
  assert.match(sql, /COALESCE\(c\.suspended, FALSE\) = FALSE/);
  assert.deepEqual(values.slice(1), ["store", "admin"]);
  await assert.rejects(requestSupportAccess(admin, "store", database()), /suspended|active owner/);
});

test("owner approval returns a random token once, storing only its hash with 15-minute expiry", async () => {
  const db = database([{ storeId: "store" }]);
  const first = await approveSupportAccess(owner, "request", db);
  const second = await approveSupportAccess(owner, "another-request", db);
  assert.equal(isSupportToken(first.token), true);
  assert.notEqual(first.token, second.token);
  const { sql, values } = db.queries[0];
  assert.deepEqual(values, ["request", "owner", hashSupportToken(first.token)]);
  assert.equal(values.includes(first.token), false);
  assert.match(sql, /INTERVAL '15 minutes'/);
  assert.match(sql, /r\.status = 'PENDING'/);
  assertLiveChecks(sql);
});

test("admins, managers and impersonated owners cannot approve or revoke", async () => {
  const db = database();
  for (const session of [admin, { ...owner, role: "MANAGER" as const }, { ...support, role: "OWNER" as const }]) {
    await assert.rejects(approveSupportAccess(session, "request", db), /store owner/);
    await assert.rejects(revokeSupportAccess(session, "request", db), /store owner/);
  }
  assert.equal(db.queries.length, 0);
});

test("wrong owner, suspended store, and already-approved request are denied by conditional approval", async () => {
  await assert.rejects(approveSupportAccess(owner, "request", database()), /cannot be approved/);
});

test("request listings expose metadata only and restrict to actual owning owner or exact requester", async () => {
  const db = database();
  await listSupportRequests(owner, db);
  const { sql, values } = db.queries[0];
  assert.deepEqual(values, ["owner", "OWNER"]);
  assert.match(sql, /r\.owner_user_id = \$1 AND s\."ownerUserId" = \$1/);
  assert.match(sql, /r\.admin_user_id = \$1/);
  assert.doesNotMatch(sql, /token_hash|SELECT r\.\*/);
  await assert.rejects(listSupportRequests(support, db), /Owner or platform admin/);
});

test("redemption is a parameterized atomic update with replay, expiry, identity and suspension guards", async () => {
  const db = database([{ id: "request", storeId: "store", ownerUserId: "owner" }]);
  assert.deepEqual(await consumeSupportAccess(admin, token, db), { id: "request", storeId: "store", ownerUserId: "owner" });
  const { sql, values } = db.queries[0];
  assert.deepEqual(values, [hashSupportToken(token), "admin"]);
  assert.match(sql, /^UPDATE support_access_requests/);
  assert.match(sql, /r\.admin_user_id = \$2/);
  assert.match(sql, /r\.used_at IS NULL AND r\.expires_at > NOW\(\)/);
  assert.match(sql, /r\.revoked_at IS NULL/);
  assert.match(sql, /session_expires_at = NOW\(\) \+ INTERVAL '30 minutes'/);
  assert.match(sql, /RETURNING r\.id/);
  assertLiveChecks(sql);
});

test("redemption rejects malformed tokens, other roles, and impersonated admins before querying", async () => {
  const db = database();
  await assert.rejects(consumeSupportAccess(admin, "", db), /valid owner-shared/);
  await assert.rejects(consumeSupportAccess(owner, token, db), /valid owner-shared/);
  await assert.rejects(consumeSupportAccess({ ...admin, impersonatedBy: support.impersonatedBy }, token, db), /valid owner-shared/);
  assert.equal(db.queries.length, 0);
});

test("only one concurrent redemption receives the consumed record", async () => {
  let used = false;
  const db = {
    async $executeRawUnsafe() {},
    async $queryRawUnsafe(sql: string) {
      assert.match(sql, /r\.used_at IS NULL AND r\.expires_at > NOW\(\)/);
      if (used) return [];
      used = true;
      return [{ id: "request", storeId: "store", ownerUserId: "owner" }];
    },
  };
  const attempts = await Promise.allSettled([consumeSupportAccess(admin, token, db), consumeSupportAccess(admin, token, db)]);
  assert.equal(attempts.filter((attempt) => attempt.status === "fulfilled").length, 1);
  assert.equal(attempts.filter((attempt) => attempt.status === "rejected").length, 1);
});

test("expired, replayed, revoked, wrong-admin and suspended links fail closed", async () => {
  await assert.rejects(consumeSupportAccess(admin, token, database()), /expired, used, revoked/);
});

test("support session validation binds the consumed access record to exact admin, owner and store", async () => {
  const db = database([{ id: "request" }]);
  assert.equal(await isSupportSessionAuthorized(support, db), true);
  const { sql, values } = db.queries[0];
  assert.deepEqual(values, ["request", "store", "owner", "admin"]);
  assert.match(sql, /r\.status = 'CONSUMED'/);
  assert.match(sql, /r\.session_expires_at > NOW\(\)/);
  assert.match(sql, /r\.session_expires_at <= r\.used_at \+ INTERVAL '30 minutes'/);
  // The 15-minute link expiry must not shorten the consumed 30-minute session.
  assert.doesNotMatch(sql, /r\.expires_at > NOW/);
  assertLiveChecks(sql);
});

test("legacy, non-support and unauthorized or unavailable support sessions fail closed", async () => {
  const db = database();
  assert.equal(await isSupportSessionAuthorized({ ...support, supportAccessId: undefined }, db), false);
  assert.equal(await isSupportSessionAuthorized(owner, db), false);
  assert.equal(await isSupportSessionAuthorized(support, db), false);
  const unavailable = { async $executeRawUnsafe() { throw new Error("offline"); }, async $queryRawUnsafe() { return []; } };
  assert.equal(await isSupportSessionAuthorized(support, unavailable), false);
});

test("owner revocation checks active current owner and revokes consumed sessions as well as pending links", async () => {
  const db = database([{ storeId: "store" }]);
  await revokeSupportAccess(owner, "request", db);
  assert.deepEqual(db.queries[0].values, ["request", "owner"]);
  assert.match(db.queries[0].sql, /s\."ownerUserId" = \$2/);
  assert.match(db.queries[0].sql, /SET status = 'REVOKED', revoked_at = NOW\(\)/);
  await assert.rejects(revokeSupportAccess(owner, "another-owner-request", database()), /cannot be revoked/);
});

test("PostgreSQL enforces single-use links, exact identities, expiry, suspension and revocation", {
  skip: !process.env.SUPPORT_ACCESS_TEST_DATABASE_URL,
}, async () => {
  const { Pool } = createRequire(import.meta.url)("pg");
  const pool = new Pool({ connectionString: process.env.SUPPORT_ACCESS_TEST_DATABASE_URL });
  const schema = `support_test_${Date.now()}`;
  const client = await pool.connect();
  const db = {
    async $executeRawUnsafe(sql: string, ...values: unknown[]) { await client.query(sql, values); },
    async $queryRawUnsafe(sql: string, ...values: unknown[]) {
      const connection = await pool.connect();
      try {
        await connection.query(`SET search_path TO "${schema}"`);
        return (await connection.query(sql, values)).rows;
      } finally { connection.release(); }
    },
  };
  try {
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET search_path TO "${schema}"`);
    await client.query(`CREATE TABLE stores (id TEXT PRIMARY KEY, name TEXT, "ownerUserId" TEXT)`);
    await client.query(`CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT, email TEXT, role TEXT, active BOOLEAN, "storeId" TEXT)`);
    await client.query(`INSERT INTO stores VALUES ('store', 'Test Store', 'owner'), ('home-store', 'Home Store', 'owner')`);
    await client.query(`INSERT INTO users VALUES
      ('owner', 'Owner', 'owner@example.test', 'OWNER', TRUE, 'home-store'),
      ('other-owner', 'Other Owner', 'other-owner@example.test', 'OWNER', TRUE, 'store'),
      ('admin', 'Admin', 'admin@example.test', 'PLATFORM_ADMIN', TRUE, 'platform'),
      ('other-admin', 'Other Admin', 'other-admin@example.test', 'PLATFORM_ADMIN', TRUE, 'platform')`);
    const issue = async () => {
      const id = await requestSupportAccess(admin, "store", db);
      return { id, ...await approveSupportAccess(owner, id, db) };
    };
    const pendingId = await requestSupportAccess(admin, "store", db);
    const otherOwner = { ...owner, userId: "other-owner" };
    const otherAdmin = { ...admin, userId: "other-admin" };
    assert.equal((await listSupportRequests(owner, db)).length, 1);
    assert.equal((await listSupportRequests(otherOwner, db)).length, 0);
    assert.equal((await listSupportRequests(otherAdmin, db)).length, 0);
    await assert.rejects(approveSupportAccess(otherOwner, pendingId, db));
    const link = await approveSupportAccess(owner, pendingId, db);
    await assert.rejects(approveSupportAccess(owner, pendingId, db));
    await assert.rejects(consumeSupportAccess(otherAdmin, link.token, db));
    const stored = await client.query(`SELECT token_hash FROM support_access_requests WHERE id = $1`, [pendingId]);
    assert.equal(stored.rows[0].token_hash, hashSupportToken(link.token));
    const concurrent = await Promise.allSettled([
      consumeSupportAccess(admin, link.token, db), consumeSupportAccess(admin, link.token, db),
    ]);
    assert.equal(concurrent.filter((result) => result.status === "fulfilled").length, 1);
    const activeSession = { ...support, supportAccessId: pendingId };
    assert.equal(await isSupportSessionAuthorized(activeSession, db), true);
    await client.query(`UPDATE support_access_requests SET expires_at = NOW() - INTERVAL '1 minute' WHERE id = $1`, [pendingId]);
    assert.equal(await isSupportSessionAuthorized(activeSession, db), true);
    assert.equal(await isSupportSessionAuthorized({ ...activeSession, impersonatedBy: { ...support.impersonatedBy, userId: "other-admin" } }, db), false);
    assert.equal(await isSupportSessionAuthorized({ ...activeSession, userId: "other-owner" }, db), false);
    assert.equal(await isSupportSessionAuthorized({ ...activeSession, storeId: "another-store" }, db), false);
    await client.query(`UPDATE stores SET "ownerUserId" = 'other-owner' WHERE id = 'store'`);
    assert.equal(await isSupportSessionAuthorized(activeSession, db), false);
    await client.query(`UPDATE stores SET "ownerUserId" = 'owner' WHERE id = 'store'`);
    await client.query(`UPDATE users SET active = FALSE WHERE id = 'admin'`);
    assert.equal(await isSupportSessionAuthorized(activeSession, db), false);
    await client.query(`UPDATE users SET active = TRUE WHERE id = 'admin'`);
    await client.query(`UPDATE users SET active = FALSE WHERE id = 'owner'`);
    assert.equal(await isSupportSessionAuthorized(activeSession, db), false);
    await client.query(`UPDATE users SET active = TRUE WHERE id = 'owner'`);
    const revokedAdminLink = await issue();
    await client.query(`INSERT INTO session_revocations (user_id) VALUES ('admin')`);
    await assert.rejects(consumeSupportAccess(admin, revokedAdminLink.token, db));
    await client.query(`DELETE FROM session_revocations WHERE user_id = 'admin'`);
    await client.query(`UPDATE users SET role = 'MANAGER' WHERE id = 'owner'`);
    assert.equal(await isSupportSessionAuthorized(activeSession, db), false);
    await client.query(`UPDATE users SET role = 'OWNER' WHERE id = 'owner'`);
    await client.query(`UPDATE users SET role = 'MANAGER' WHERE id = 'admin'`);
    assert.equal(await isSupportSessionAuthorized(activeSession, db), false);
    await client.query(`UPDATE users SET role = 'PLATFORM_ADMIN' WHERE id = 'admin'`);
    await revokeSupportAccess(owner, pendingId, db);
    assert.equal(await isSupportSessionAuthorized(activeSession, db), false);
    const expired = await issue();
    await client.query(`UPDATE support_access_requests SET expires_at = NOW() - INTERVAL '1 minute' WHERE id = $1`, [expired.id]);
    await assert.rejects(consumeSupportAccess(admin, expired.token, db));
    const inactiveAdminLink = await issue();
    await client.query(`UPDATE users SET active = FALSE WHERE id = 'admin'`);
    await assert.rejects(consumeSupportAccess(admin, inactiveAdminLink.token, db));
    await client.query(`UPDATE users SET active = TRUE WHERE id = 'admin'`);
    const inactiveOwnerRequest = await requestSupportAccess(admin, "store", db);
    await client.query(`UPDATE users SET active = FALSE WHERE id = 'owner'`);
    await assert.rejects(approveSupportAccess(owner, inactiveOwnerRequest, db));
    await client.query(`UPDATE users SET active = TRUE WHERE id = 'owner'`);
    const suspendedLink = await issue();
    const pendingSuspension = await requestSupportAccess(admin, "store", db);
    await client.query(`INSERT INTO store_access_controls (store_id, suspended) VALUES ('store', TRUE)`);
    await assert.rejects(requestSupportAccess(admin, "store", db));
    await assert.rejects(approveSupportAccess(owner, pendingSuspension, db));
    await assert.rejects(consumeSupportAccess(admin, suspendedLink.token, db));
    await client.query(`UPDATE store_access_controls SET suspended = FALSE, updated_at = NOW() WHERE store_id = 'store'`);
    await assert.rejects(consumeSupportAccess(admin, suspendedLink.token, db));
    const resumed = await issue();
    await consumeSupportAccess(admin, resumed.token, db);
    const resumedSession = { ...support, supportAccessId: resumed.id };
    assert.equal(await isSupportSessionAuthorized(resumedSession, db), true);
    await client.query(`UPDATE support_access_requests SET session_expires_at = used_at + INTERVAL '31 minutes' WHERE id = $1`, [resumed.id]);
    assert.equal(await isSupportSessionAuthorized(resumedSession, db), false);
    await client.query(`UPDATE support_access_requests SET session_expires_at = NOW() - INTERVAL '1 minute' WHERE id = $1`, [resumed.id]);
    assert.equal(await isSupportSessionAuthorized(resumedSession, db), false);
    const activeBeforeSuspension = await issue();
    await consumeSupportAccess(admin, activeBeforeSuspension.token, db);
    const suspendedSession = { ...support, supportAccessId: activeBeforeSuspension.id };
    assert.equal(await isSupportSessionAuthorized(suspendedSession, db), true);
    await client.query(`INSERT INTO session_revocations (user_id) VALUES ('admin')`);
    assert.equal(await isSupportSessionAuthorized(suspendedSession, db), false);
    await client.query(`DELETE FROM session_revocations WHERE user_id = 'admin'`);
    await client.query(`UPDATE store_access_controls SET suspended = TRUE, updated_at = NOW() WHERE store_id = 'store'`);
    assert.equal(await isSupportSessionAuthorized(suspendedSession, db), false);
    await client.query(`UPDATE store_access_controls SET suspended = FALSE, updated_at = NOW() WHERE store_id = 'store'`);
    assert.equal(await isSupportSessionAuthorized(suspendedSession, db), false);
  } finally {
    await client.query(`SET search_path TO public`);
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    client.release();
    await pool.end();
  }
});
