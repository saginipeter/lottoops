import { prisma } from "@/lib/prisma";

let schemaReady = false;
async function ensureSchema() {
  if (schemaReady || !prisma) return;
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS store_feature_flags (store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE, feature_key TEXT NOT NULL, enabled BOOLEAN NOT NULL DEFAULT FALSE, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (store_id, feature_key))`);
  schemaReady = true;
}

export async function isStoreFeatureEnabled(storeId: string, featureKey: string) {
  if (!prisma) return true;
  try {
    await ensureSchema();
    const rows = await prisma.$queryRawUnsafe(`SELECT enabled FROM store_feature_flags WHERE store_id = $1 AND feature_key = $2 LIMIT 1`, storeId, featureKey) as Array<{ enabled: boolean }>;
    return rows.length === 0 || rows[0].enabled;
  } catch {
    return true;
  }
}
