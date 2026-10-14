import { createHash, randomBytes, randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/session";

interface SupportDatabase {
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<unknown>;
  $queryRawUnsafe(query: string, ...values: unknown[]): Promise<unknown>;
}

export interface SupportRequest {
  id: string;
  storeId: string;
  storeName: string;
  adminName: string;
  adminEmail: string;
  status: string;
  createdAt: Date;
  expiresAt: Date | null;
  sessionExpiresAt: Date | null;
}

export class SupportAccessError extends Error {}

const readyDatabases = new WeakSet<SupportDatabase>();

export function isSameOriginMutation(request: Request) {
  const origin = request.headers.get("origin");
  return origin !== null && origin === new URL(request.url).origin
    && request.headers.get("sec-fetch-site") !== "cross-site";
}

export function hashSupportToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function isSupportToken(token: unknown): token is string {
  return typeof token === "string" && /^[a-f0-9]{64}$/.test(token);
}

export async function ensureSupportAccessSchema(db: SupportDatabase = prisma) {
  if (!db) throw new SupportAccessError("Database unavailable.");
  if (readyDatabases.has(db)) return;
  await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS store_access_controls (
    store_id TEXT PRIMARY KEY REFERENCES stores(id) ON DELETE CASCADE,
    suspended BOOLEAN NOT NULL DEFAULT FALSE, reason TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
  await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS session_revocations (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    revoked_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
  await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS support_access_requests (
    id TEXT PRIMARY KEY,
    store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    owner_user_id TEXT NOT NULL REFERENCES users(id),
    admin_user_id TEXT NOT NULL REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'PENDING',
    token_hash TEXT UNIQUE,
    approved_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    used_at TIMESTAMPTZ,
    session_expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_support_access_owner_created ON support_access_requests(owner_user_id, created_at DESC)`);
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_support_access_admin_created ON support_access_requests(admin_user_id, created_at DESC)`);
  readyDatabases.add(db);
}

// Live identity and suspension checks are part of the mutation, not just cookie checks.
const LIVE_ACCESS = `EXISTS (
  SELECT 1 FROM stores s
  JOIN users owner ON owner.id = s."ownerUserId"
  JOIN users admin ON admin.id = r.admin_user_id
  LEFT JOIN store_access_controls c ON c.store_id = s.id
  WHERE s.id = r.store_id AND s."ownerUserId" = r.owner_user_id
    AND owner.active = TRUE AND owner.role = 'OWNER'
    AND admin.active = TRUE AND admin.role = 'PLATFORM_ADMIN'
    AND COALESCE(c.suspended, FALSE) = FALSE
    AND (r.approved_at IS NULL OR c.updated_at IS NULL OR c.updated_at <= r.approved_at)
    AND NOT EXISTS (SELECT 1 FROM session_revocations rev
      WHERE rev.user_id = r.admin_user_id AND rev.revoked_at >= r.created_at)
)`;

export async function requestSupportAccess(session: SessionPayload, storeId: string, db: SupportDatabase = prisma) {
  if (session.role !== "PLATFORM_ADMIN" || session.impersonatedBy) throw new SupportAccessError("Platform admin access required.");
  await ensureSupportAccessSchema(db);
  const id = randomUUID();
  const rows = await db.$queryRawUnsafe(`INSERT INTO support_access_requests (id, store_id, owner_user_id, admin_user_id)
    SELECT $1, s.id, owner.id, admin.id FROM stores s
    JOIN users owner ON owner.id = s."ownerUserId"
    JOIN users admin ON admin.id = $3
    LEFT JOIN store_access_controls c ON c.store_id = s.id
    WHERE s.id = $2 AND owner.active = TRUE AND owner.role = 'OWNER'
      AND admin.active = TRUE AND admin.role = 'PLATFORM_ADMIN'
      AND COALESCE(c.suspended, FALSE) = FALSE
    RETURNING id`, id, storeId, session.userId) as Array<{ id: string }>;
  if (!rows.length) throw new SupportAccessError("Store is suspended or has no active owner.");
  return id;
}

export async function listSupportRequests(session: SessionPayload, db: SupportDatabase = prisma): Promise<SupportRequest[]> {
  if (session.impersonatedBy || !["OWNER", "PLATFORM_ADMIN"].includes(session.role)) throw new SupportAccessError("Owner or platform admin access required.");
  await ensureSupportAccessSchema(db);
  return await db.$queryRawUnsafe(`SELECT r.id, r.store_id AS "storeId", s.name AS "storeName",
    admin.name AS "adminName", admin.email AS "adminEmail", r.status,
    r.created_at AS "createdAt", r.expires_at AS "expiresAt", r.session_expires_at AS "sessionExpiresAt"
    FROM support_access_requests r JOIN stores s ON s.id = r.store_id
    JOIN users admin ON admin.id = r.admin_user_id
    JOIN users viewer ON viewer.id = $1 AND viewer.active = TRUE
    WHERE (($2 = 'OWNER' AND viewer.role = 'OWNER' AND r.owner_user_id = $1 AND s."ownerUserId" = $1)
      OR ($2 = 'PLATFORM_ADMIN' AND viewer.role = 'PLATFORM_ADMIN' AND r.admin_user_id = $1))
    ORDER BY r.created_at DESC LIMIT 100`, session.userId, session.role) as SupportRequest[];
}

export async function approveSupportAccess(session: SessionPayload, requestId: string, db: SupportDatabase = prisma) {
  if (session.role !== "OWNER" || session.impersonatedBy) throw new SupportAccessError("Only the store owner can approve access.");
  await ensureSupportAccessSchema(db);
  const token = randomBytes(32).toString("hex");
  const rows = await db.$queryRawUnsafe(`UPDATE support_access_requests r
    SET status = 'APPROVED', token_hash = $3, approved_at = NOW(), expires_at = NOW() + INTERVAL '15 minutes'
    WHERE r.id = $1 AND r.owner_user_id = $2 AND r.status = 'PENDING'
      AND r.used_at IS NULL AND r.revoked_at IS NULL AND ${LIVE_ACCESS}
    RETURNING r.store_id AS "storeId"`, requestId, session.userId, hashSupportToken(token)) as Array<{ storeId: string }>;
  if (!rows.length) throw new SupportAccessError("Request cannot be approved.");
  return { token, storeId: rows[0].storeId };
}

export async function consumeSupportAccess(session: SessionPayload, token: string, db: SupportDatabase = prisma) {
  if (session.role !== "PLATFORM_ADMIN" || session.impersonatedBy || !isSupportToken(token)) throw new SupportAccessError("A valid owner-shared link and the requesting admin account are required.");
  await ensureSupportAccessSchema(db);
  const rows = await db.$queryRawUnsafe(`UPDATE support_access_requests r
    SET status = 'CONSUMED', used_at = NOW(), session_expires_at = NOW() + INTERVAL '30 minutes'
    WHERE r.token_hash = $1 AND r.admin_user_id = $2 AND r.status = 'APPROVED'
      AND r.used_at IS NULL AND r.expires_at > NOW() AND r.revoked_at IS NULL AND ${LIVE_ACCESS}
    RETURNING r.id, r.store_id AS "storeId", r.owner_user_id AS "ownerUserId"`,
  hashSupportToken(token), session.userId) as Array<{ id: string; storeId: string; ownerUserId: string }>;
  if (!rows.length) throw new SupportAccessError("Link is expired, used, revoked, or not authorized for this admin.");
  return rows[0];
}

export async function revokeSupportAccess(session: SessionPayload, requestId: string, db: SupportDatabase = prisma) {
  if (session.role !== "OWNER" || session.impersonatedBy) throw new SupportAccessError("Only the store owner can revoke access.");
  await ensureSupportAccessSchema(db);
  const rows = await db.$queryRawUnsafe(`UPDATE support_access_requests r SET status = 'REVOKED', revoked_at = NOW()
    WHERE r.id = $1 AND r.owner_user_id = $2 AND r.revoked_at IS NULL
      AND EXISTS (SELECT 1 FROM stores s JOIN users owner ON owner.id = s."ownerUserId"
        WHERE s.id = r.store_id AND s."ownerUserId" = $2 AND owner.active = TRUE AND owner.role = 'OWNER')
    RETURNING r.store_id AS "storeId"`, requestId, session.userId) as Array<{ storeId: string }>;
  if (!rows.length) throw new SupportAccessError("Request cannot be revoked.");
  return rows[0];
}

export async function isSupportSessionAuthorized(session: SessionPayload & { supportAccessId?: string }, db: SupportDatabase = prisma) {
  if (!db || !session.impersonatedBy || !session.supportAccessId || session.role !== "MANAGER") return false;
  try {
    await ensureSupportAccessSchema(db);
    const rows = await db.$queryRawUnsafe(`SELECT r.id FROM support_access_requests r
      WHERE r.id = $1 AND r.store_id = $2 AND r.owner_user_id = $3 AND r.admin_user_id = $4
        AND r.status = 'CONSUMED' AND r.used_at IS NOT NULL AND r.revoked_at IS NULL
        AND r.session_expires_at > NOW() AND r.session_expires_at <= r.used_at + INTERVAL '30 minutes'
        AND ${LIVE_ACCESS} LIMIT 1`,
    session.supportAccessId, session.storeId, session.userId, session.impersonatedBy.userId) as Array<{ id: string }>;
    return rows.length === 1;
  } catch {
    return false;
  }
}
