import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiSession } from "@/lib/api-session";
import { isManagerOrAbove } from "@/lib/permissions";

let schemaReady = false;

async function ensureActivitySchema() {
  if (schemaReady) return;

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS inventory_activity_logs (
      id BIGSERIAL PRIMARY KEY,
      store_id TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      detail TEXT NOT NULL,
      performed_by_id TEXT NOT NULL,
      performed_by_name TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_inventory_activity_logs_store_created
    ON inventory_activity_logs (store_id, created_at DESC)
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE inventory_activity_logs
    ADD COLUMN IF NOT EXISTS resolved BOOLEAN NOT NULL DEFAULT FALSE
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE inventory_activity_logs
    ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE inventory_activity_logs
    ADD COLUMN IF NOT EXISTS resolved_by_id TEXT
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE inventory_activity_logs
    ADD COLUMN IF NOT EXISTS resolved_by_name TEXT
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_inventory_activity_logs_unresolved
    ON inventory_activity_logs (store_id, resolved, created_at DESC)
  `);

  schemaReady = true;
}

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
    await ensureActivitySchema();

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
        ORDER BY logs.created_at DESC
        LIMIT 50
        `,
        session.userId
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
      ORDER BY logs.created_at DESC
      LIMIT 50
      `,
      session.storeId
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
