import { prisma } from "@/lib/prisma";

let schemaReady = false;
async function ensureSchema() {
  if (schemaReady || !prisma) return;
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS platform_audit_logs (id BIGSERIAL PRIMARY KEY, action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT, detail TEXT NOT NULL, performed_by_id TEXT NOT NULL, performed_by_name TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
  schemaReady = true;
}

export async function logPlatformActivity(input: { action: string; entityType: string; entityId?: string; detail: string; performedById: string; performedByName: string }) {
  if (!prisma) return;
  await ensureSchema();
  await prisma.$executeRawUnsafe(`INSERT INTO platform_audit_logs (action, entity_type, entity_id, detail, performed_by_id, performed_by_name) VALUES ($1, $2, $3, $4, $5, $6)`, input.action, input.entityType, input.entityId ?? null, input.detail, input.performedById, input.performedByName);
}
