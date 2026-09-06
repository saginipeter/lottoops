import { NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";

const FEATURE_KEYS = ["OCR_RECEIPTS", "WHATSAPP_SUMMARIES", "AI_DISCREPANCY_ANALYSIS"] as const;
type FeatureKey = (typeof FEATURE_KEYS)[number];

let schemaReady = false;
async function ensureSchema() {
  if (schemaReady || !prisma) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS store_feature_flags (
      store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
      feature_key TEXT NOT NULL,
      enabled BOOLEAN NOT NULL DEFAULT FALSE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (store_id, feature_key)
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
    const stores = await prisma.store.findMany({ where: { ownerUserId: { not: null } }, select: { id: true, name: true }, orderBy: { name: "asc" } });
    const flags = await prisma.$queryRawUnsafe(`SELECT store_id AS "storeId", feature_key AS "featureKey", enabled FROM store_feature_flags`) as Array<{ storeId: string; featureKey: FeatureKey; enabled: boolean }>;
    return NextResponse.json({ stores, flags });
  } catch (error) {
    console.error("[GET /api/platform/features]", error);
    return NextResponse.json({ error: "Unable to load feature flags." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!isPlatformAdmin(session.role)) return NextResponse.json({ error: "Platform admin access required." }, { status: 403 });
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const body = await request.json().catch(() => ({}));
  const storeId = typeof body.storeId === "string" ? body.storeId.trim() : "";
  const featureKey = body.featureKey as FeatureKey;
  if (!storeId || !FEATURE_KEYS.includes(featureKey) || typeof body.enabled !== "boolean") return NextResponse.json({ error: "Store, feature, and enabled status are required." }, { status: 400 });
  try {
    await ensureSchema();
    const store = await prisma.store.findFirst({ where: { id: storeId, ownerUserId: { not: null } }, select: { id: true } });
    if (!store) return NextResponse.json({ error: "Store not found." }, { status: 404 });
    await prisma.$executeRawUnsafe(`INSERT INTO store_feature_flags (store_id, feature_key, enabled) VALUES ($1, $2, $3) ON CONFLICT (store_id, feature_key) DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = NOW()`, storeId, featureKey, body.enabled);
    return NextResponse.json({ success: true, storeId, featureKey, enabled: body.enabled });
  } catch (error) {
    console.error("[PATCH /api/platform/features]", error);
    return NextResponse.json({ error: "Unable to update feature flag." }, { status: 500 });
  }
}
