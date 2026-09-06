import { NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (session.role !== "PLATFORM_ADMIN") return NextResponse.json({ error: "Platform admin access required." }, { status: 403 });
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  try {
    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS inventory_activity_logs (id BIGSERIAL PRIMARY KEY, store_id TEXT NOT NULL, action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT, detail TEXT NOT NULL, performed_by_id TEXT NOT NULL, performed_by_name TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS platform_audit_logs (id BIGSERIAL PRIMARY KEY, action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT, detail TEXT NOT NULL, performed_by_id TEXT NOT NULL, performed_by_name TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
    const rows = await prisma.$queryRawUnsafe(`
      SELECT logs.id, logs.store_id AS "storeId", stores.name AS "storeName", logs.action,
             logs.entity_type AS "entityType", logs.entity_id AS "entityId", logs.detail,
             logs.performed_by_name AS "performedByName", logs.created_at AS "createdAt"
      FROM inventory_activity_logs logs
      LEFT JOIN stores ON stores.id = logs.store_id
      ORDER BY logs.created_at DESC
      LIMIT 100
    `) as Array<{ id: bigint | number | string; storeId: string; storeName: string | null; action: string; entityType: string; entityId: string | null; detail: string; performedByName: string | null; createdAt: Date }>;
    const platformRows = await prisma.$queryRawUnsafe(`SELECT id, action, entity_type AS "entityType", entity_id AS "entityId", detail, performed_by_name AS "performedByName", created_at AS "createdAt" FROM platform_audit_logs ORDER BY created_at DESC LIMIT 100`) as Array<{ id: bigint | number | string; action: string; entityType: string; entityId: string | null; detail: string; performedByName: string | null; createdAt: Date }>;
    const activities = [
      ...rows.map((row) => ({ ...row, id: typeof row.id === "bigint" ? row.id.toString() : row.id })),
      ...platformRows.map((row) => ({ ...row, id: `platform_${typeof row.id === "bigint" ? row.id.toString() : row.id}`, storeId: "platform", storeName: "LottoOps Platform" })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 100);
    return NextResponse.json({ activities });
  } catch (error) {
    console.error("[GET /api/platform/activity]", error);
    return NextResponse.json({ error: "Unable to load platform activity." }, { status: 500 });
  }
}
