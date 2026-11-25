import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiSession } from "@/lib/api-session";
import { isManagerOrAbove } from "@/lib/permissions";
import { parseReportDateRange } from "@/lib/report-date-range";

interface OverrideRow {
  id: string;
  storeId: string;
  storeName: string;
  detail: string;
  performedByName: string | null;
  createdAt: Date;
  expectedPackQuantity: number | null;
  recordedPackQuantity: number | null;
  quantityUnit: string | null;
}

interface TicketQuantityOverrideRow {
  id: string;
  storeId: string;
  storeName: string;
  packId: string;
  serialNumber: string;
  packNumber: string | null;
  gameName: string;
  gameNumber: string;
  expectedTicketQuantity: number;
  recordedTicketQuantity: number;
  reason: string;
  status: string;
  actorName: string | null;
  createdAt: Date;
}

function parseLegacyPackCounts(detail: string) {
  const previousApprovalFormat = detail.match(/^Shipment override approved for invoice .+?:\s*expected\s+(\d+),\s*scanned\s+(\d+)\./i);
  if (previousApprovalFormat) {
    return {
      expectedPackQuantity: Number(previousApprovalFormat[1]),
      recordedPackQuantity: Number(previousApprovalFormat[2]),
    };
  }
  const expected = detail.match(/\bexpected\s+(\d+)\s+packs?\b/i)?.[1];
  const recorded = detail.match(/\b(?:recorded|scanned)\s+(\d+)\s+packs?\b/i)?.[1];
  return {
    expectedPackQuantity: expected === undefined ? null : Number(expected),
    recordedPackQuantity: recorded === undefined ? null : Number(recorded),
  };
}

export async function GET(req: NextRequest) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!isManagerOrAbove(session)) return NextResponse.json({ error: "Manager or owner access required." }, { status: 403 });
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const range = parseReportDateRange(req.nextUrl.searchParams);
  if ("error" in range) return NextResponse.json({ error: range.error }, { status: 400 });

  try {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT logs.id::text AS id, logs.store_id AS "storeId", stores.name AS "storeName",
              logs.detail, logs.performed_by_name AS "performedByName", logs.created_at AS "createdAt",
              logs.expected_pack_quantity AS "expectedPackQuantity",
              logs.recorded_pack_quantity AS "recordedPackQuantity",
              logs.quantity_unit AS "quantityUnit"
       FROM inventory_activity_logs logs
       JOIN stores ON stores.id = logs.store_id
       WHERE logs.action = 'SHIPMENT_OVERRIDE'
         AND ($1 = 'OWNER' AND stores."ownerUserId" = $2 OR $1 <> 'OWNER' AND logs.store_id = $3)
         AND logs.created_at >= $4 AND logs.created_at <= $5
       ORDER BY logs.created_at DESC
       LIMIT 50`,
      session.role,
      session.userId,
      session.storeId,
      range.fromDate,
      range.toDate,
    ) as OverrideRow[];

    const ticketQuantityOverrides = await prisma.$queryRawUnsafe(
      `SELECT audit.id, audit.store_id AS "storeId", stores.name AS "storeName",
              audit.pack_id AS "packId", audit.serial_number AS "serialNumber",
              audit.pack_number AS "packNumber", audit.game_name AS "gameName",
              audit.game_number AS "gameNumber",
              audit.expected_ticket_quantity AS "expectedTicketQuantity",
              audit.recorded_ticket_quantity AS "recordedTicketQuantity",
              audit.reason, audit.status, actors.name AS "actorName", audit.created_at AS "createdAt"
       FROM pack_ticket_quantity_overrides audit
       JOIN stores ON stores.id = audit.store_id
       LEFT JOIN packs ON packs.id = audit.pack_id AND packs."storeId" = audit.store_id
       LEFT JOIN games ON games.id = packs."gameId" AND games."storeId" = audit.store_id
       LEFT JOIN users actors ON actors.id = audit.actor_user_id AND actors."storeId" = audit.store_id
       WHERE ($1 = 'OWNER' AND stores."ownerUserId" = $2 OR $1 <> 'OWNER' AND audit.store_id = $3)
         AND audit.created_at >= $4 AND audit.created_at <= $5
       ORDER BY audit.created_at DESC
       LIMIT 250`,
      session.role,
      session.userId,
      session.storeId,
      range.fromDate,
      range.toDate,
    ) as TicketQuantityOverrideRow[];

    const notifications = rows.map((row) => {
      const legacy = parseLegacyPackCounts(row.detail);
      return {
        ...row,
        expectedPackQuantity: row.expectedPackQuantity ?? legacy.expectedPackQuantity,
        recordedPackQuantity: row.recordedPackQuantity ?? legacy.recordedPackQuantity,
        quantityUnit: row.quantityUnit ?? "PACKS",
      };
    });
    return NextResponse.json({ notifications, ticketQuantityOverrides });
  } catch (error) {
    console.error("[GET /api/notifications/overrides]", error);
    return NextResponse.json({ error: "Unable to load shipment override report." }, { status: 500 });
  }
}
