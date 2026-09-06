import type { SessionPayload } from "@/lib/session";
import { prisma } from "@/lib/prisma";

let schemaReady = false;

async function ensureSchema() {
  if (schemaReady || !prisma) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS session_revocations (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      revoked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  schemaReady = true;
}

export async function revokeUserSessions(userId: string) {
  if (!prisma) return;
  await ensureSchema();
  await prisma.$executeRawUnsafe(`
    INSERT INTO session_revocations (user_id, revoked_at)
    VALUES ($1, NOW())
    ON CONFLICT (user_id) DO UPDATE SET revoked_at = NOW()
  `, userId);
}

export async function isSessionRevoked(session: SessionPayload & { iat?: number }) {
  if (!prisma || !session.iat) return false;
  await ensureSchema();
  const rows = await prisma.$queryRawUnsafe(
    `SELECT revoked_at AS "revokedAt" FROM session_revocations WHERE user_id = $1 LIMIT 1`,
    session.userId,
  ) as Array<{ revokedAt: Date }>;
  return rows.length > 0 && session.iat * 1000 <= new Date(rows[0].revokedAt).getTime();
}
