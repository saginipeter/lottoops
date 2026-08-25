import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiSession } from "@/lib/api-session";
import { isManagerOrAbove } from "@/lib/permissions";

interface TicketReportRow {
  id: number;
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

export async function GET() {
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

  try {
    if (session.role === "OWNER") {
      const ownerStores = await prisma.store.findMany({
        where: { ownerUserId: session.userId },
        select: { id: true },
      });
      const storeIds = ownerStores.map((store: { id: string }) => store.id);

      if (storeIds.length === 0) {
        return NextResponse.json({ reports: [] });
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
          AND logs.store_id = ANY($1)
        ORDER BY logs.created_at DESC
        LIMIT 50
        `,
        storeIds
      )) as TicketReportRow[];

      return NextResponse.json({ reports });
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
        AND logs.store_id = $1
      ORDER BY logs.created_at DESC
      LIMIT 50
      `,
      session.storeId
    )) as TicketReportRow[];

    return NextResponse.json({ reports });
  } catch (error) {
    console.error("[GET /api/tickets/reports]", error);
    return NextResponse.json(
      { error: "Unable to load ticket reports." },
      { status: 500 }
    );
  }
}
