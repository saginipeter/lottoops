import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiSession } from "@/lib/api-session";
import { isManagerOrAbove } from "@/lib/permissions";
import { ensureDeviceRegistrySchema } from "@/lib/device-registry";

const sourcePrefixes: Record<string, string> = {
  LOW_TICKETS: "LOW_TICKETS:",
  INCOMPLETE_AUDIT: "AUDIT:",
  STALE_RECEIVING: "SHIPMENT:",
  SHIPMENT_OVERRIDE: "SHIPMENT_OVERRIDE:",
  DEVICE_HEALTH: "DEVICE:",
  TICKET_EXCEPTION: "NOTIFICATION:",
  EXPECTED_TICKET_MISMATCH: "NOTIFICATION:",
  WRONG_PACK_OR_GAME: "NOTIFICATION:",
  DUPLICATE_PACK: "NOTIFICATION:",
  TICKET_RETURN_REVIEW: "NOTIFICATION:",
  PACK_UPDATE: "NOTIFICATION:",
  INVENTORY_AUDIT_VARIANCE: "NOTIFICATION:",
};

async function sourceExists(storeId: string, type: string, alertKey: string): Promise<boolean> {
  const prefix = sourcePrefixes[type] ?? (/^[A-Z][A-Z0-9_]{1,80}$/.test(type) ? "NOTIFICATION:" : undefined);
  if (!prefix || !alertKey.startsWith(prefix)) return false;
  const sourceId = alertKey.slice(prefix.length);
  if (!sourceId || sourceId.length > 200) return false;

  if (type === "LOW_TICKETS") {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT EXISTS(SELECT 1 FROM packs p WHERE p.id = $1 AND p."storeId" = $2) AS exists`,
      sourceId, storeId,
    ) as Array<{ exists: boolean }>;
    return rows[0]?.exists === true;
  }
  if (type === "INCOMPLETE_AUDIT") {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT EXISTS(SELECT 1 FROM shifts s WHERE s.id = $1 AND s."storeId" = $2) AS exists`,
      sourceId, storeId,
    ) as Array<{ exists: boolean }>;
    return rows[0]?.exists === true;
  }
  if (type === "STALE_RECEIVING") {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT EXISTS(SELECT 1 FROM shipments WHERE id = $1 AND "storeId" = $2) AS exists`,
      sourceId, storeId,
    ) as Array<{ exists: boolean }>;
    return rows[0]?.exists === true;
  }
  if (type === "SHIPMENT_OVERRIDE") {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT EXISTS(SELECT 1 FROM inventory_activity_logs WHERE id::text = $1 AND store_id = $2 AND action = 'SHIPMENT_OVERRIDE') AS exists`,
      sourceId, storeId,
    ) as Array<{ exists: boolean }>;
    return rows[0]?.exists === true;
  }
  if (type === "DEVICE_HEALTH") {
    await ensureDeviceRegistrySchema();
    const [deviceId, seenAtMs, healthStatus, pairStatus, extra] = sourceId.split(":");
    if (!deviceId || !/^\d+$/.test(seenAtMs ?? "") || !["OFFLINE", "STALE", "ONLINE", "INACTIVE"].includes(healthStatus ?? "") || !["PAIRED", "UNPAIRED"].includes(pairStatus ?? "") || extra !== undefined) return false;
    const rows = await prisma.$queryRawUnsafe(
      `SELECT EXISTS(SELECT 1 FROM store_devices WHERE id = $1 AND store_id = $2) AS exists`,
      deviceId, storeId,
    ) as Array<{ exists: boolean }>;
    return rows[0]?.exists === true;
  }

  const rows = await prisma.$queryRawUnsafe(
    `SELECT EXISTS(SELECT 1 FROM inventory_notifications WHERE id = $1 AND store_id = $2 AND notification_type = $3) AS exists`,
    sourceId, storeId, type,
  ) as Array<{ exists: boolean }>;
  return rows[0]?.exists === true;
}

export async function POST(req: NextRequest) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!isManagerOrAbove(session)) return NextResponse.json({ error: "Manager or owner access required." }, { status: 403 });
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const body = await req.json().catch(() => null) as { alertKey?: unknown; type?: unknown } | null;
  const alertKey = typeof body?.alertKey === "string" ? body.alertKey.trim() : "";
  const type = typeof body?.type === "string" ? body.type.trim() : "";
  if (!alertKey || !type || (!sourcePrefixes[type] && !/^[A-Z][A-Z0-9_]{1,80}$/.test(type))) {
    return NextResponse.json({ error: "A valid alert key and type are required." }, { status: 400 });
  }

  try {
    if (!(await sourceExists(session.storeId, type, alertKey))) {
      return NextResponse.json({ error: "This alert is no longer available in your store." }, { status: 404 });
    }
      await prisma.$executeRawUnsafe(`
        INSERT INTO operational_alert_acknowledgments (id, store_id, alert_key, alert_type, cleared_by_id)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (store_id, alert_key) DO UPDATE
          SET alert_type = EXCLUDED.alert_type, cleared_at = NOW(), cleared_by_id = EXCLUDED.cleared_by_id, resolved_at = NULL
      `, `alert_ack_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`, session.storeId, alertKey, type, session.userId);
    return NextResponse.json({ success: true, alertKey });
  } catch (error) {
    console.error("[POST /api/alerts/operational/clear]", error);
    return NextResponse.json({ error: "Unable to clear this operational alert." }, { status: 500 });
  }
}
