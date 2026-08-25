import { NextRequest, NextResponse } from "next/server";
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

  schemaReady = true;
}

interface OwnedReportRow {
  id: number | bigint;
  storeId: string;
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const resolvedParams = await params;
  const reportId = Number(resolvedParams.id);

  if (!Number.isInteger(reportId) || reportId <= 0) {
    return NextResponse.json({ error: "Invalid report id." }, { status: 400 });
  }

  try {
    await ensureActivitySchema();

    let ownedRows: OwnedReportRow[] = [];

    if (session.role === "OWNER") {
      ownedRows = (await prisma.$queryRawUnsafe(
        `
        SELECT logs.id, logs.store_id AS "storeId"
        FROM inventory_activity_logs logs
        JOIN stores ON stores.id = logs.store_id
        WHERE logs.id = $1
          AND logs.action = 'TICKET_REPORTED'
          AND stores.owner_user_id = $2
        LIMIT 1
        `,
        reportId,
        session.userId
      )) as OwnedReportRow[];
    } else {
      ownedRows = (await prisma.$queryRawUnsafe(
        `
        SELECT logs.id, logs.store_id AS "storeId"
        FROM inventory_activity_logs logs
        WHERE logs.id = $1
          AND logs.action = 'TICKET_REPORTED'
          AND logs.store_id = $2
        LIMIT 1
        `,
        reportId,
        session.storeId
      )) as OwnedReportRow[];
    }

    if (!ownedRows[0]) {
      return NextResponse.json({ error: "Report not found." }, { status: 404 });
    }

    await prisma.$executeRawUnsafe(
      `
      UPDATE inventory_activity_logs
      SET resolved = TRUE,
          resolved_at = NOW(),
          resolved_by_id = $2,
          resolved_by_name = $3
      WHERE id = $1
      `,
      reportId,
      session.userId,
      session.name
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[POST /api/tickets/reports/[id]/resolve]", error);
    return NextResponse.json({ error: "Unable to resolve ticket report." }, { status: 500 });
  }
}
