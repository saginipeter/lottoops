import { NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";

const RESOLUTION_STATUSES = ["RETRY", "DISCARDED"];

async function ensureTable() {
  if (!prisma) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS pos_reconciliation_items (
      id TEXT PRIMARY KEY,
      store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
      queue_id TEXT NOT NULL,
      terminal_id TEXT NOT NULL,
      barcode TEXT NOT NULL,
      reason TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'OPEN',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      resolved_by_id TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
      resolved_at TIMESTAMPTZ NULL,
      resolution_note TEXT NULL,
      UNIQUE(store_id, queue_id)
    )
  `);
}

async function getAccess() {
  const session = await getApiSession();
  if (!session) return { error: NextResponse.json({ error: "Not authenticated." }, { status: 401 }) };
  if (!prisma) return { error: NextResponse.json({ error: "Database not connected." }, { status: 503 }) };
  return { session };
}

export async function GET(request: NextRequest) {
  const access = await getAccess();
  if (access.error) return access.error;
  try {
    await ensureTable();
    const terminalId = request.nextUrl.searchParams.get("terminalId");
    const manager = access.session.role === "OWNER" || access.session.role === "MANAGER";
    const rows = await prisma.$queryRawUnsafe(`
      SELECT id, queue_id AS "queueId", terminal_id AS "terminalId", barcode, reason, attempts, status, created_at AS "createdAt", updated_at AS "updatedAt", resolved_at AS "resolvedAt", resolution_note AS "resolutionNote"
      FROM pos_reconciliation_items
      WHERE store_id = $1
        AND ($2::text IS NULL OR terminal_id = $2)
        AND (${manager ? "TRUE" : "status IN ('OPEN', 'RETRY', 'DISCARDED')"})
      ORDER BY updated_at DESC
    `, access.session.storeId, terminalId || null) as Array<Record<string, unknown>>;
    return NextResponse.json({ items: rows });
  } catch (error) {
    console.error("[GET /api/pos/reconciliation]", error);
    return NextResponse.json({ error: "Unable to load reconciliation items." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const access = await getAccess();
  if (access.error) return access.error;
  try {
    await ensureTable();
    const body = await request.json().catch(() => ({}));
    const queueId = typeof body.queueId === "string" ? body.queueId.trim() : "";
    const terminalId = typeof body.terminalId === "string" ? body.terminalId.trim().toUpperCase() : "";
    const barcode = typeof body.barcode === "string" ? body.barcode.trim() : "";
    const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 1000) : "";
    const attempts = Number.isFinite(body.attempts) ? Number(body.attempts) : 0;
    if (!queueId || !terminalId || !barcode || !reason) return NextResponse.json({ error: "Queue ID, terminal, barcode, and conflict reason are required." }, { status: 400 });
    const id = `recon_${queueId}`.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 180);
    await prisma.$executeRawUnsafe(`
      INSERT INTO pos_reconciliation_items (id, store_id, queue_id, terminal_id, barcode, reason, attempts, status, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'OPEN', NOW())
      ON CONFLICT (store_id, queue_id) DO UPDATE SET reason = EXCLUDED.reason, attempts = EXCLUDED.attempts, status = CASE WHEN pos_reconciliation_items.status = 'DISCARDED' THEN pos_reconciliation_items.status ELSE 'OPEN' END, updated_at = NOW()
    `, id, access.session.storeId, queueId, terminalId, barcode, reason, attempts);
    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error("[POST /api/pos/reconciliation]", error);
    return NextResponse.json({ error: "Unable to record reconciliation item." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const access = await getAccess();
  if (access.error) return access.error;
  if (access.session.role !== "OWNER" && access.session.role !== "MANAGER") return NextResponse.json({ error: "Manager access required." }, { status: 403 });
  try {
    await ensureTable();
    const body = await request.json().catch(() => ({}));
    const id = typeof body.id === "string" ? body.id : "";
    const status = typeof body.status === "string" ? body.status : "";
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : null;
    if (!id || !RESOLUTION_STATUSES.includes(status)) return NextResponse.json({ error: "A reconciliation item and RETRY or DISCARDED decision are required." }, { status: 400 });
    const updated = await prisma.$executeRawUnsafe(`UPDATE pos_reconciliation_items SET status = $1, resolved_by_id = $2, resolved_at = NOW(), resolution_note = $3, updated_at = NOW() WHERE id = $4 AND store_id = $5`, status, access.session.userId, note, id, access.session.storeId);
    if (updated !== 1) return NextResponse.json({ error: "Reconciliation item not found." }, { status: 404 });
    return NextResponse.json({ success: true, id, status });
  } catch (error) {
    console.error("[PATCH /api/pos/reconciliation]", error);
    return NextResponse.json({ error: "Unable to apply reconciliation decision." }, { status: 500 });
  }
}
