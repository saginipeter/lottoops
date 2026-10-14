import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiSession } from "@/lib/api-session";
import { ensureActivitySchema } from "@/lib/activity-log";
import { isManagerOrAbove } from "@/lib/permissions";

export async function GET() {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!isManagerOrAbove(session)) return NextResponse.json({ error: "Manager or owner access required." }, { status: 403 });
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  try {
    await ensureActivitySchema();
    const rows = (await prisma.$queryRawUnsafe(
      `
      SELECT logs.id, logs.store_id AS "storeId", stores.name AS "storeName",
             logs.detail, logs.performed_by_name AS "performedByName",
             logs.created_at AS "createdAt"
      FROM inventory_activity_logs logs
      JOIN stores ON stores.id = logs.store_id
      WHERE logs.action = 'SHIPMENT_OVERRIDE'
        AND (logs.store_id = $3 OR (($1)::text = 'OWNER' AND stores."ownerUserId" = ($2)::text))
      ORDER BY logs.created_at DESC
      LIMIT 50
      `,
      session.role,
      session.userId,
      session.storeId
    )) as unknown[];

    return NextResponse.json({ notifications: rows });
  } catch (error) {
    console.error("Unable to load shipment overrides:", error);
    return NextResponse.json({ error: "Unable to load shipment overrides." }, { status: 500 });
  }
}
