import { prisma } from "@/lib/prisma";

export interface InventoryNotificationInput {
  storeId: string;
  type: string;
  /** Human-readable source/entity ID; can be a pack, audit line, or event. */
  entityId: string;
  /** Stable key for idempotent retries; distinct attempts should use distinct values. */
  eventKey?: string;
  packId?: string | null;
  title: string;
  detail: string;
  severity?: string;
}

export async function createInventoryNotification(input: InventoryNotificationInput) {
  if (!prisma) return;
  const eventKey = input.eventKey ?? input.entityId;
  await prisma.$executeRawUnsafe(`
    INSERT INTO inventory_notifications
      (id, store_id, notification_type, entity_id, event_key, pack_id, title, detail, severity)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (store_id, notification_type, event_key) DO NOTHING
  `,
    `notification_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    input.storeId,
    input.type,
    input.entityId,
    eventKey,
    input.packId ?? null,
    input.title,
    input.detail,
    input.severity ?? "HIGH",
  );
}
