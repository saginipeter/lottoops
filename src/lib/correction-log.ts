import { prisma } from "@/lib/prisma";

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
