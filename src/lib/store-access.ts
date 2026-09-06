import { prisma } from "@/lib/prisma";

let schemaReady = false;
async function ensureSchema() {
  if (schemaReady || !prisma) return;
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS store_access_controls (store_id TEXT PRIMARY KEY REFERENCES stores(id) ON DELETE CASCADE, suspended BOOLEAN NOT NULL DEFAULT FALSE, reason TEXT, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
  schemaReady = true;
}

export async function isStoreSuspended(storeId: string) {
  if (!prisma) return false;
  try {
    await ensureSchema();
    const rows = await prisma.$queryRawUnsafe(`SELECT suspended FROM store_access_controls WHERE store_id = $1 LIMIT 1`, storeId) as Array<{ suspended: boolean }>;
    return rows[0]?.suspended === true;
  } catch {
    return false;
  }
}
