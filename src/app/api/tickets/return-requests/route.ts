import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiSession } from "@/lib/api-session";
import { isManagerOrAbove } from "@/lib/permissions";
import { getSafeCurrentTicket } from "@/lib/ticket-quantity";
import { canReturnLatestTicket } from "@/lib/ticket-return";
import { Prisma } from "@prisma/client";
import { parseReportDateRange } from "@/lib/report-date-range";

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
  await prisma.$executeRawUnsafe(`ALTER TABLE ticket_return_requests ADD COLUMN IF NOT EXISTS sale_event_id TEXT`);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_ticket_return_requests_sale
    ON ticket_return_requests (store_id, sale_event_id) WHERE sale_event_id IS NOT NULL
  `);
  // Persist the manager alert in the same transaction as the returned ticket.
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS inventory_notifications (
      id TEXT PRIMARY KEY,
      store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
      notification_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      title TEXT NOT NULL,
      detail TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'HIGH',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(store_id, notification_type, entity_id)
    )
  `);
  schemaReady = true;
}

class ReturnError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/** Restore the latest sold ticket immediately and queue a manager review. */
export async function POST(req: NextRequest) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!["EMPLOYEE", "SHIFT_LEAD", "MANAGER", "OWNER"].includes(session.role)) {
    return NextResponse.json({ error: "Ticket sales access required." }, { status: 403 });
  }
  if (!prisma) return NextResponse.json({ error: "Database not connected" }, { status: 503 });

  try {
    const body = await req.json().catch(() => ({}));
    const packId = typeof body?.packId === "string" ? body.packId.trim() : "";
    const shiftId = typeof body?.shiftId === "string" ? body.shiftId.trim() : "";
    const ticketBarcode = typeof body?.ticketBarcode === "string" ? body.ticketBarcode.trim() : "";
    const saleId = typeof body?.saleId === "string" ? body.saleId.trim() : "";
    const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
    if (!packId || !shiftId || !ticketBarcode || !saleId) {
      return NextResponse.json({ error: "packId, shiftId, ticketBarcode, and saleId are required." }, { status: 400 });
    }
    if (reason.length < 6) {
      return NextResponse.json({ error: "A return reason of at least 6 characters is required." }, { status: 400 });
    }
    await ensureSchema();
    const id = `trr_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Serialize with shift close and ticket sales before reading counts/events.
      await tx.$queryRawUnsafe(`SELECT id FROM shifts WHERE id = $1 AND "storeId" = $2 FOR UPDATE`, shiftId, session.storeId);
      await tx.$queryRawUnsafe(`SELECT id FROM packs WHERE id = $1 AND "storeId" = $2 FOR UPDATE`, packId, session.storeId);
      const pack = await tx.pack.findFirst({
        where: { id: packId, storeId: session.storeId },
        select: {
          id: true, serialNumber: true, status: true, currentTicketNumber: true,
          firstTicket: true, ticketQuantity: true, ticketPrice: true, game: { select: { price: true } },
        },
      });
      if (!pack) throw new ReturnError("Pack not found.", 404);
      const shift = await tx.shift.findFirst({
        where: { id: shiftId, storeId: session.storeId },
        include: { lines: { where: { packId }, take: 1 } },
      });
      if (!shift) throw new ReturnError("Shift not found.", 404);
      if (shift.status !== "OPEN") throw new ReturnError("Tickets can only be returned during an open shift.", 409);
      const line = shift.lines[0];
      if (!line) throw new ReturnError("No shift line found for this pack.", 409);
      const priorReturns = await tx.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT id FROM ticket_return_requests WHERE store_id = $1 AND sale_event_id = $2 LIMIT 1`,
        session.storeId, saleId,
      );
      if (priorReturns.length > 0) throw new ReturnError("This sale has already been returned. Refresh before trying again.", 409);
      const latestScans = await tx.$queryRawUnsafe<Array<{ id: string; ticketBarcode: string }>>(`
        SELECT id, ticket_barcode AS "ticketBarcode" FROM live_scan_events
        WHERE store_id = $1 AND shift_id = $2 AND pack_id = $3
        ORDER BY scanned_at DESC, id DESC LIMIT 1
      `, session.storeId, shiftId, packId);
      const latestScan = latestScans[0];
      if (!latestScan || latestScan.id !== saleId || !canReturnLatestTicket({
        role: session.role, requestedBarcode: ticketBarcode, latestBarcode: latestScan.ticketBarcode,
      })) throw new ReturnError("Only the latest sold ticket for this pack can be returned.", 409);

      const beginning = getSafeCurrentTicket({
        currentTicketNumber: Number(line.beginningTicket ?? 0),
        firstTicket: pack.firstTicket, ticketQuantity: pack.ticketQuantity,
      });
      const current = Number(pack.currentTicketNumber ?? beginning);
      if (!Number.isInteger(current) || !Number.isInteger(beginning) || beginning <= 0 || current < 0 || current >= beginning ||
          (pack.status !== "ACTIVE" && pack.status !== "SOLD_OUT")) {
        throw new ReturnError("No recent sale to reverse for this pack.", 409);
      }
      const slot = await tx.displaySlot.findFirst({
        where: { storeId: session.storeId, slotNumber: line.slotNumber },
        select: { id: true, packId: true },
      });
      if (!slot || (slot.packId && slot.packId !== pack.id)) {
        throw new ReturnError("The original display slot is unavailable or occupied.", 409);
      }
      const restoredCurrent = current + 1;
      const ticketsSold = beginning - restoredCurrent;
      const salesAmount = ticketsSold * Number(pack.ticketPrice ?? pack.game.price);
      const updated = await tx.pack.updateMany({
        where: { id: pack.id, storeId: session.storeId, status: { in: ["ACTIVE", "SOLD_OUT"] }, currentTicketNumber: pack.currentTicketNumber },
        data: { status: "ACTIVE", currentTicketNumber: restoredCurrent, completedAt: null },
      });
      if (updated.count !== 1) throw new ReturnError("Ticket changed. Refresh before trying again.", 409);
      const deleted = await tx.$executeRawUnsafe(
        `DELETE FROM live_scan_events WHERE id = $1 AND store_id = $2 AND shift_id = $3 AND pack_id = $4`,
        latestScan.id, session.storeId, shiftId, packId,
      );
      if (deleted !== 1) throw new ReturnError("Ticket already returned or changed.", 409);
      await tx.shiftLine.update({
        where: { id: line.id },
        data: { beginningTicket: beginning, endingTicket: restoredCurrent, ticketsSold, salesAmount },
      });
      const updatedSlot = await tx.displaySlot.updateMany({
        where: { id: slot.id, storeId: session.storeId, packId: slot.packId },
        data: { packId: pack.id },
      });
      if (updatedSlot.count !== 1) throw new ReturnError("The display slot changed. Refresh before trying again.", 409);
      await tx.$executeRawUnsafe(`
        INSERT INTO ticket_return_requests
          (id, store_id, shift_id, pack_id, ticket_barcode, status, reason, requested_by_id, requested_by_name, sale_event_id)
        VALUES ($1, $2, $3, $4, $5, 'RETURNED_PENDING_REVIEW', $6, $7, $8, $9)
      `, id, session.storeId, shiftId, packId, ticketBarcode, reason, session.userId, session.name, saleId);
      await tx.scanLogEntry.create({
        data: {
          storeId: session.storeId, action: "RETURNED", packId: pack.id, performedById: session.userId,
          detail: `Returned latest ticket ${ticketBarcode} for pack ${pack.serialNumber} to slot ${line.slotNumber}; awaiting manager review. Reason: ${reason}`,
        },
      });
      await tx.$executeRawUnsafe(`
        INSERT INTO inventory_notifications
          (id, store_id, notification_type, entity_id, title, detail, severity)
        VALUES ($1, $2, 'TICKET_RETURN_REVIEW', $3, $4, $5, 'MEDIUM')
      `, `notification_${id}`, session.storeId, id, "Returned ticket needs manager review",
      `${session.name} returned ticket ${ticketBarcode} from pack ${pack.serialNumber} to slot ${line.slotNumber}. Available for sale immediately. Reason: ${reason}`);
      return { currentTicketNumber: restoredCurrent, ticketsSold, salesAmount };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return NextResponse.json({ success: true, mode: "returned-pending-review", status: "RETURNED_PENDING_REVIEW", id, ...result });
  } catch (error) {
    if (error instanceof ReturnError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2034") {
      return NextResponse.json({ error: "Ticket or shift changed. Refresh before trying again." }, { status: 409 });
    }
    console.error("[POST /api/tickets/return-requests]", error);
    return NextResponse.json({ error: "Unable to return ticket." }, { status: 500 });
  }
}

/** Manager/owner view of returned tickets awaiting review and legacy requests awaiting approval. */
export async function GET(req?: NextRequest) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!isManagerOrAbove(session)) {
    return NextResponse.json({ error: "Manager or owner access required." }, { status: 403 });
  }
  if (!prisma) return NextResponse.json({ error: "Database not connected" }, { status: 503 });
  try {
    await ensureSchema();
    const hasDateFilter = Boolean(req?.nextUrl.searchParams.get("from") || req?.nextUrl.searchParams.get("to"));
    const range = hasDateFilter ? parseReportDateRange(req!.nextUrl.searchParams) : null;
    if (range && "error" in range) return NextResponse.json({ error: range.error }, { status: 400 });
    const dateSql = range && !("error" in range) ? " AND r.created_at >= $2 AND r.created_at <= $3" : "";
    const baseSelect = `
      SELECT r.id, r.status, r.store_id AS "storeId", stores.name AS "storeName",
        r.shift_id AS "shiftId", r.pack_id AS "packId", r.ticket_barcode AS "ticketBarcode",
        r.reason, r.requested_by_name AS "requestedByName", r.created_at AS "createdAt",
        p."serialNumber" AS "serialNumber", g.name AS "gameName", g."gameNumber" AS "gameNumber"
      FROM ticket_return_requests r
      JOIN packs p ON p.id = r.pack_id
      JOIN games g ON g.id = p."gameId"
      JOIN stores ON stores.id = r.store_id
      WHERE r.status IN ('PENDING', 'RETURNED_PENDING_REVIEW')${dateSql}
    `;
    const rows = session.role === "OWNER"
      ? await prisma.$queryRawUnsafe(`${baseSelect} AND stores."ownerUserId" = $1 ORDER BY r.created_at DESC LIMIT 50`, session.userId, ...(range && !("error" in range) ? [range.fromDate, range.toDate] : []))
      : await prisma.$queryRawUnsafe(`${baseSelect} AND r.store_id = $1 ORDER BY r.created_at DESC LIMIT 50`, session.storeId, ...(range && !("error" in range) ? [range.fromDate, range.toDate] : []));
    return NextResponse.json({ requests: rows });
  } catch (error) {
    console.error("[GET /api/tickets/return-requests]", error);
    return NextResponse.json({ error: "Unable to load return requests." }, { status: 500 });
  }
}
