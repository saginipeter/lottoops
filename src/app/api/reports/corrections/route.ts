import { NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";
import { isManagerOrAbove } from "@/lib/permissions";

export async function GET() {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!isManagerOrAbove(session)) return NextResponse.json({ error: "Manager access required." }, { status: 403 });
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  try {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT id, entity_type AS "entityType", entity_id AS "entityId",
             field_name AS "fieldName", old_value AS "oldValue", new_value AS "newValue",
             reason, corrected_by_id AS "correctedById", corrected_by_name AS "correctedByName",
             created_at AS "createdAt"
      FROM inventory_correction_logs
      WHERE store_id = $1
      ORDER BY created_at DESC
      LIMIT 200
    `, session.storeId);
    return NextResponse.json({ corrections: rows });
  } catch (error) {
    console.error("[GET /api/reports/corrections]", error);
    return NextResponse.json({ corrections: [] });
  }
}
