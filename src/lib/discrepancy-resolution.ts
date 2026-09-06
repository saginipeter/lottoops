import { prisma } from "@/lib/prisma";

let schemaReady = false;

async function ensureSchema() {
  if (schemaReady || !prisma) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS discrepancy_resolutions (
      id TEXT PRIMARY KEY,
      store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
      discrepancy_type TEXT NOT NULL,
      discrepancy_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      resolved_by_id TEXT NOT NULL REFERENCES users(id),
      resolved_by_name TEXT,
      resolved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(store_id, discrepancy_type, discrepancy_id)
    )
  `);
  schemaReady = true;
}

export async function getResolutionMap(storeId: string) {
  if (!prisma) return new Map<string, { reason: string; resolvedByName: string | null; resolvedAt: Date }>();
  await ensureSchema();
  const rows = await prisma.$queryRawUnsafe(`SELECT discrepancy_type AS "type", discrepancy_id AS "id", reason, resolved_by_name AS "resolvedByName", resolved_at AS "resolvedAt" FROM discrepancy_resolutions WHERE store_id = $1`, storeId) as Array<{ type: string; id: string; reason: string; resolvedByName: string | null; resolvedAt: Date }>;
  return new Map(rows.map((row) => [`${row.type}:${row.id}`, { reason: row.reason, resolvedByName: row.resolvedByName, resolvedAt: row.resolvedAt }]));
}

export async function resolveDiscrepancy(input: { storeId: string; type: string; id: string; reason: string; userId: string; userName: string }) {
  if (!prisma) return;
  await ensureSchema();
  await prisma.$executeRawUnsafe(`
    INSERT INTO discrepancy_resolutions (id, store_id, discrepancy_type, discrepancy_id, reason, resolved_by_id, resolved_by_name)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (store_id, discrepancy_type, discrepancy_id)
    DO UPDATE SET reason = EXCLUDED.reason, resolved_by_id = EXCLUDED.resolved_by_id, resolved_by_name = EXCLUDED.resolved_by_name, resolved_at = NOW()
  `, `resolution_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`, input.storeId, input.type, input.id, input.reason, input.userId, input.userName);
}
