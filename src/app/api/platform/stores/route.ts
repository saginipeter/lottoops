import { NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";

interface PlatformStore { id: string; name: string; ownerUserId: string | null; users: Array<{ name: string; email: string }> }

let schemaReady = false;
async function ensureSchema() {
  if (schemaReady || !prisma) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS store_access_controls (
      store_id TEXT PRIMARY KEY REFERENCES stores(id) ON DELETE CASCADE,
      suspended BOOLEAN NOT NULL DEFAULT FALSE,
      reason TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  schemaReady = true;
}

function isPlatformAdmin(role: string) { return role === "PLATFORM_ADMIN"; }

export async function GET() {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!isPlatformAdmin(session.role)) return NextResponse.json({ error: "Platform admin access required." }, { status: 403 });
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  try {
    await ensureSchema();
    const stores = await prisma.store.findMany({ where: { ownerUserId: { not: null } }, select: { id: true, name: true, ownerUserId: true, users: { where: { role: "OWNER" }, select: { name: true, email: true }, take: 1 } }, orderBy: { name: "asc" } }) as PlatformStore[];
    const controls = await prisma.$queryRawUnsafe(`SELECT store_id AS "storeId", suspended, reason, updated_at AS "updatedAt" FROM store_access_controls`) as Array<{ storeId: string; suspended: boolean; reason: string | null; updatedAt: Date }>;
    const controlMap = new Map(controls.map((control) => [control.storeId, control]));
    return NextResponse.json({ stores: stores.map((store) => ({ ...store, owner: store.users[0] ?? null, access: controlMap.get(store.id) ?? { suspended: false, reason: null, updatedAt: null } })) });
  } catch (error) {
    console.error("[GET /api/platform/stores]", error);
    return NextResponse.json({ error: "Unable to load platform stores." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!isPlatformAdmin(session.role)) return NextResponse.json({ error: "Platform admin access required." }, { status: 403 });
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const body = await request.json().catch(() => ({}));
  const storeId = typeof body.storeId === "string" ? body.storeId.trim() : "";
  const suspended = typeof body.suspended === "boolean" ? body.suspended : null;
  const reason = typeof body.reason === "string" ? body.reason.trim() : null;
  if (!storeId || suspended === null) return NextResponse.json({ error: "Store ID and suspended status are required." }, { status: 400 });
  try {
    await ensureSchema();
    const store = await prisma.store.findFirst({ where: { id: storeId, ownerUserId: { not: null } }, select: { id: true } });
    if (!store) return NextResponse.json({ error: "Store not found." }, { status: 404 });
    await prisma.$executeRawUnsafe(`INSERT INTO store_access_controls (store_id, suspended, reason) VALUES ($1, $2, $3) ON CONFLICT (store_id) DO UPDATE SET suspended = EXCLUDED.suspended, reason = EXCLUDED.reason, updated_at = NOW()`, storeId, suspended, suspended ? reason || "Platform compliance hold" : null);
    return NextResponse.json({ success: true, storeId, suspended });
  } catch (error) {
    console.error("[PATCH /api/platform/stores]", error);
    return NextResponse.json({ error: "Unable to update store access." }, { status: 500 });
  }
}
