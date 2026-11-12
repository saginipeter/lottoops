import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiSession } from "@/lib/api-session";
import { isManagerOrAbove } from "@/lib/permissions";
import { parseReportDateRange } from "@/lib/report-date-range";

interface TicketReportRow {
  id: number | bigint;
  storeId: string;
  storeName: string;
  action: string;
  entityType: string;
  entityId: string | null;
  detail: string;
  performedById: string;
  performedByName: string | null;
  createdAt: Date;
}

function serializeReports(rows: TicketReportRow[]) {
  return rows.map((row) => ({
    ...row,
    id: typeof row.id === "bigint" ? row.id.toString() : String(row.id),
  }));
}

export async function GET(req: NextRequest) {
  const session = await getApiSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!isManagerOrAbove(session)) {
    return NextResponse.json({ error: "Manager or owner access required." }, { status: 403 });
  }

  if (!prisma) {
    return NextResponse.json({ error: "Database not connected" }, { status: 503 });
  }
  const range = parseReportDateRange(req.nextUrl.searchParams);
  if ("error" in range) return NextResponse.json({ error: range.error }, { status: 400 });

  try {
    if (session.role === "OWNER") {
      const reports = (await prisma.$queryRawUnsafe(
        `
        SELECT
          logs.id,
          logs.store_id AS "storeId",
          stores.name AS "storeName",
          logs.action,
          logs.entity_type AS "entityType",
          logs.entity_id AS "entityId",
          logs.detail,
          logs.performed_by_id AS "performedById",
          logs.performed_by_name AS "performedByName",
          logs.created_at AS "createdAt"
        FROM inventory_activity_logs logs
        JOIN stores ON stores.id = logs.store_id
        WHERE logs.action = 'TICKET_REPORTED'
          AND COALESCE(logs.resolved, FALSE) = FALSE
          AND stores."ownerUserId" = $1
          AND logs.created_at >= $2
          AND logs.created_at <= $3
        ORDER BY logs.created_at DESC
        LIMIT 50
        `,
        session.userId,
        range.fromDate,
        range.toDate
      )) as TicketReportRow[];

      return NextResponse.json({ reports: serializeReports(reports) });
    }

    const reports = (await prisma.$queryRawUnsafe(
      `
      SELECT
        logs.id,
        logs.store_id AS "storeId",
        stores.name AS "storeName",
        logs.action,
        logs.entity_type AS "entityType",
        logs.entity_id AS "entityId",
        logs.detail,
        logs.performed_by_id AS "performedById",
        logs.performed_by_name AS "performedByName",
        logs.created_at AS "createdAt"
      FROM inventory_activity_logs logs
      JOIN stores ON stores.id = logs.store_id
      WHERE logs.action = 'TICKET_REPORTED'
        AND COALESCE(logs.resolved, FALSE) = FALSE
        AND logs.store_id = $1
        AND logs.created_at >= $2
        AND logs.created_at <= $3
      ORDER BY logs.created_at DESC
      LIMIT 50
      `,
      session.storeId,
      range.fromDate,
      range.toDate
    )) as TicketReportRow[];

    return NextResponse.json({ reports: serializeReports(reports) });
  } catch (error) {
    console.error("[GET /api/tickets/reports]", error);
    return NextResponse.json(
      { error: "Unable to load ticket reports." },
      { status: 500 }
    );
  }
}
