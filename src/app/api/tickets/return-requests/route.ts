import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiSession } from "@/lib/api-session";
import { isManagerOrAbove } from "@/lib/permissions";

let schemaReady = false;

async function ensureSchema() {
  if (schemaReady) return;

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS ticket_return_requests (
      id TEXT PRIMARY KEY,
      store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
      shift_id TEXT NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
      pack_id TEXT NOT NULL REFERENCES packs(id) ON DELETE CASCADE,
      ticket_barcode TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING',
      reason TEXT,
      requested_by_id TEXT NOT NULL REFERENCES users(id) ON DELETE SET NULL,
      requested_by_name TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      resolved_at TIMESTAMPTZ,
      resolved_by_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      resolved_by_name TEXT
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_ticket_return_requests_pending
    ON ticket_return_requests (store_id, status, created_at DESC)
  `);

  schemaReady = true;
}

/**
 * POST /api/tickets/return-requests
 * Employee submits a request to return a ticket the customer rejected.
 * Body: { packId, shiftId, ticketBarcode?, reason? }
 */
export async function POST(req: NextRequest) {
  const session = await getApiSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!prisma) {
    return NextResponse.json({ error: "Database not connected" }, { status: 503 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const packId = typeof body?.packId === "string" ? body.packId.trim() : "";
    const shiftId = typeof body?.shiftId === "string" ? body.shiftId.trim() : "";
    const ticketBarcode = typeof body?.ticketBarcode === "string" ? body.ticketBarcode.trim() : "";
    const reason = typeof body?.reason === "string" ? body.reason.trim() : "";

    if (!packId) {
      return NextResponse.json({ error: "packId is required." }, { status: 400 });
    }
    if (!shiftId) {
      return NextResponse.json({ error: "shiftId is required." }, { status: 400 });
    }

    const pack = await prisma.pack.findFirst({
      where: { id: packId, storeId: session.storeId },
      select: { id: true, serialNumber: true },
    });
    if (!pack) {
      return NextResponse.json({ error: "Pack not found." }, { status: 404 });
    }

    const shift = await prisma.shift.findFirst({
      where: { id: shiftId, storeId: session.storeId },
      select: { id: true },
    });
    if (!shift) {
      return NextResponse.json({ error: "Shift not found." }, { status: 404 });
    }

    await ensureSchema();

    // Prevent duplicate pending requests for the same pack.
    const existing = (await prisma.$queryRawUnsafe(
      `
      SELECT id FROM ticket_return_requests
      WHERE store_id = $1 AND pack_id = $2 AND status = 'PENDING'
      LIMIT 1
      `,
      session.storeId,
      packId
    )) as { id: string }[];
    if (existing.length > 0) {
      return NextResponse.json(
        { error: "A return request for this ticket is already pending manager approval." },
        { status: 409 }
      );
    }

    const id = `trr_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    await prisma.$executeRawUnsafe(
      `
      INSERT INTO ticket_return_requests
        (id, store_id, shift_id, pack_id, ticket_barcode, reason, requested_by_id, requested_by_name)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      id,
      session.storeId,
      shiftId,
      packId,
      ticketBarcode || pack.serialNumber,
      reason || null,
      session.userId,
      session.name
    );

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error("[POST /api/tickets/return-requests]", error);
    return NextResponse.json({ error: "Unable to submit return request." }, { status: 500 });
  }
}

/**
 * GET /api/tickets/return-requests
 * Manager/owner view of pending ticket return requests awaiting approval.
 */
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
    await ensureSchema();

    const baseSelect = `
      SELECT
        r.id,
        r.store_id AS "storeId",
        stores.name AS "storeName",
        r.shift_id AS "shiftId",
        r.pack_id AS "packId",
        r.ticket_barcode AS "ticketBarcode",
        r.reason,
        r.requested_by_name AS "requestedByName",
        r.created_at AS "createdAt",
        p."serialNumber" AS "serialNumber",
        g.name AS "gameName",
        g."gameNumber" AS "gameNumber"
      FROM ticket_return_requests r
      JOIN packs p ON p.id = r.pack_id
      JOIN games g ON g.id = p."gameId"
      JOIN stores ON stores.id = r.store_id
      WHERE r.status = 'PENDING'
    `;

    const rows =
      session.role === "OWNER"
        ? ((await prisma.$queryRawUnsafe(
            `${baseSelect} AND stores."ownerUserId" = $1 ORDER BY r.created_at DESC LIMIT 50`,
            session.userId
          )) as unknown[])
        : ((await prisma.$queryRawUnsafe(
            `${baseSelect} AND r.store_id = $1 ORDER BY r.created_at DESC LIMIT 50`,
            session.storeId
          )) as unknown[]);

    return NextResponse.json({ requests: rows });
  } catch (error) {
    console.error("[GET /api/tickets/return-requests]", error);
    return NextResponse.json({ error: "Unable to load return requests." }, { status: 500 });
  }
}
