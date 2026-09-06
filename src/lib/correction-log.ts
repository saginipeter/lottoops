import { prisma } from "@/lib/prisma";

let schemaReady = false;

async function ensureSchema() {
  if (schemaReady || !prisma) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS inventory_correction_logs (
      id TEXT PRIMARY KEY,
      store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      field_name TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT NOT NULL,
      reason TEXT NOT NULL,
      corrected_by_id TEXT NOT NULL REFERENCES users(id),
      corrected_by_name TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_inventory_correction_logs_store_created ON inventory_correction_logs(store_id, created_at DESC)`);
  schemaReady = true;
}

export async function logCorrection(input: {
  storeId: string;
  entityType: string;
  entityId: string;
  fieldName: string;
  oldValue: unknown;
  newValue: unknown;
  reason: string;
  correctedById: string;
  correctedByName?: string;
}) {
  if (!prisma) return;
  await ensureSchema();
  await prisma.$executeRawUnsafe(`
    INSERT INTO inventory_correction_logs
      (id, store_id, entity_type, entity_id, field_name, old_value, new_value, reason, corrected_by_id, corrected_by_name)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
  `,
    `correction_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    input.storeId,
    input.entityType,
    input.entityId,
    input.fieldName,
    input.oldValue === null || input.oldValue === undefined ? null : String(input.oldValue),
    String(input.newValue),
    input.reason,
    input.correctedById,
    input.correctedByName ?? null,
  );
}
