import { prisma } from "@/lib/prisma";

let schemaReady = false;

async function ensureActivitySchema() {
  if (schemaReady || !prisma) return;

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS inventory_activity_logs (
      id BIGSERIAL PRIMARY KEY,
      store_id TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      detail TEXT NOT NULL,
      performed_by_id TEXT NOT NULL,
      performed_by_name TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await prisma.$executeRawUnsafe(`ALTER TABLE inventory_activity_logs ADD COLUMN IF NOT EXISTS terminal_id TEXT`);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_inventory_activity_logs_store_created
    ON inventory_activity_logs (store_id, created_at DESC)
  `);

  schemaReady = true;
}

interface ActivityInput {
  storeId: string;
  action: string;
  entityType: string;
  entityId?: string;
  detail: string;
  performedById: string;
  performedByName?: string;
  terminalId?: string;
}

export async function logInventoryActivity(input: ActivityInput) {
  if (!prisma) return;

  await ensureActivitySchema();
  await prisma.$executeRawUnsafe(
    `
    INSERT INTO inventory_activity_logs
      (store_id, action, entity_type, entity_id, detail, performed_by_id, performed_by_name, terminal_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `,
    input.storeId,
    input.action,
    input.entityType,
    input.entityId ?? null,
    input.detail,
    input.performedById,
    input.performedByName ?? null,
    input.terminalId ?? null
  );
}

export async function queryInventoryActivity(
  storeId: string,
  options?: { from?: Date; to?: Date; limit?: number }
) {
  if (!prisma) return [];
  await ensureActivitySchema();

  const from = options?.from ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const to = options?.to ?? new Date();
  const limit = Math.min(Math.max(options?.limit ?? 500, 1), 2000);

  return prisma.$queryRawUnsafe(
    `
    SELECT
      id,
      store_id AS "storeId",
      action,
      entity_type AS "entityType",
      entity_id AS "entityId",
      detail,
      performed_by_id AS "performedById",
      performed_by_name AS "performedByName",
      terminal_id AS "terminalId",
      created_at AS "createdAt"
    FROM inventory_activity_logs
    WHERE store_id = $1
      AND created_at >= $2
      AND created_at <= $3
    ORDER BY created_at DESC
    LIMIT $4
    `,
    storeId,
    from,
    to,
    limit
  );
}
