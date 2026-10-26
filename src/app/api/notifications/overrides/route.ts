import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiSession } from "@/lib/api-session";
import { isManagerOrAbove } from "@/lib/permissions";
import { parseReportDateRange } from "@/lib/report-date-range";

export async function GET(req: NextRequest) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!isManagerOrAbove(session)) return NextResponse.json({ error: "Manager or owner access required." }, { status: 403 });
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const range = parseReportDateRange(req.nextUrl.searchParams);
  if ("error" in range) return NextResponse.json({ error: range.error }, { status: 400 });

  try {
    const rows = (await prisma.$queryRawUnsafe(
      `
      SELECT logs.id, logs.store_id AS "storeId", stores.name AS "storeName",
             logs.detail, logs.performed_by_name AS "performedByName",
             logs.created_at AS "createdAt"
      FROM inventory_activity_logs logs
      JOIN stores ON stores.id = logs.store_id
      WHERE logs.action = 'SHIPMENT_OVERRIDE'
        AND ($1 = 'OWNER' AND stores."ownerUserId" = $2 OR $1 <> 'OWNER' AND logs.store_id = $3)
        AND logs.created_at >= $4
        AND logs.created_at <= $5
      ORDER BY logs.created_at DESC
      LIMIT 50
      `,
      session.role,
      session.userId,
      session.storeId,
      range.fromDate,
      range.toDate
    )) as unknown[];

    return NextResponse.json({ notifications: rows });
  } catch {
    return NextResponse.json({ notifications: [] });
  }
}
