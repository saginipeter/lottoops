import { prisma } from "@/lib/prisma";

let schemaReady = false;
async function ensureSchema() {
  if (schemaReady || !prisma) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS inventory_notifications (
      id TEXT PRIMARY KEY,
      store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
      notification_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      title TEXT NOT NULL,
      detail TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'HIGH',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(store_id, notification_type, entity_id)
    )
  `);
  schemaReady = true;
}

export async function createInventoryNotification(input: { storeId: string; type: string; entityId: string; title: string; detail: string; severity?: string }) {
  if (!prisma) return;
  await ensureSchema();
  await prisma.$executeRawUnsafe(`
    INSERT INTO inventory_notifications (id, store_id, notification_type, entity_id, title, detail, severity)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (store_id, notification_type, entity_id) DO NOTHING
  `, `notification_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`, input.storeId, input.type, input.entityId, input.title, input.detail, input.severity ?? "HIGH");
}
