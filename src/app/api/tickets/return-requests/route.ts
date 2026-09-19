import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiSession } from "@/lib/api-session";
import { isManagerOrAbove } from "@/lib/permissions";
import { createInventoryNotification } from "@/lib/inventory-notifications";
import { getSafeCurrentTicket } from "@/lib/ticket-quantity";
import { canEmployeeSelfReturn } from "@/lib/ticket-return";
import { Prisma } from "@prisma/client";

interface LatestScanRow {
  id: string;
  ticketBarcode: string;
  scannedAt: Date;
  scannedById: string | null;
}

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
    if (reason.length < 6) {
      return NextResponse.json({ error: "A return reason of at least 6 characters is required." }, { status: 400 });
    }

    const pack = await prisma.pack.findFirst({
      where: { id: packId, storeId: session.storeId },
      select: {
        id: true,
        serialNumber: true,
        status: true,
        currentTicketNumber: true,
        firstTicket: true,
        ticketQuantity: true,
        game: { select: { price: true } },
      },
    });
    if (!pack) {
      return NextResponse.json({ error: "Pack not found." }, { status: 404 });
    }

    const shift = await prisma.shift.findFirst({
      where: { id: shiftId, storeId: session.storeId },
      include: { lines: { where: { packId }, take: 1 } },
    });
    if (!shift) {
      return NextResponse.json({ error: "Shift not found." }, { status: 404 });
    }

    await ensureSchema();

    const latestScans = (await prisma.$queryRawUnsafe(
      `
      SELECT
        id,
        ticket_barcode AS "ticketBarcode",
        scanned_at AS "scannedAt",
        scanned_by_id AS "scannedById"
      FROM live_scan_events
      WHERE store_id = $1 AND shift_id = $2 AND pack_id = $3
      ORDER BY scanned_at DESC
      LIMIT 1
      `,
      session.storeId,
      shiftId,
      packId
    )) as LatestScanRow[];
    const selfReturnCounts = (await prisma.$queryRawUnsafe(
      `
      SELECT COUNT(*)::int AS count
      FROM ticket_return_requests
      WHERE store_id = $1
        AND shift_id = $2
        AND requested_by_id = $3
        AND status = 'APPROVED_SELF'
      `,
      session.storeId,
      shiftId,
      session.userId
    )) as Array<{ count: number }>;

    const latestScan = latestScans[0] ?? null;
    const line = shift.lines[0] ?? null;
    const beginning = line
      ? getSafeCurrentTicket({
          currentTicketNumber: Number(line.beginningTicket ?? 0),
          firstTicket: pack.firstTicket,
          ticketQuantity: pack.ticketQuantity,
        })
      : 0;
    const current = Number(pack.currentTicketNumber ?? beginning);
    const slot = line
      ? await prisma.displaySlot.findFirst({
          where: { storeId: session.storeId, slotNumber: line.slotNumber },
          select: { id: true, packId: true },
        })
      : null;
    const canRestoreToSlot = Boolean(slot && (!slot.packId || slot.packId === pack.id));
    const selfReturnAllowed =
      shift.status === "OPEN" &&
      line !== null &&
      beginning > 0 &&
      current >= 0 &&
      current < beginning &&
      (pack.status === "ACTIVE" || pack.status === "SOLD_OUT") &&
      canRestoreToSlot &&
      canEmployeeSelfReturn({
        role: session.role,
        requestedBarcode: ticketBarcode,
        latestBarcode: latestScan?.ticketBarcode ?? null,
        latestScannedAt: latestScan?.scannedAt ?? null,
        latestScannedById: latestScan?.scannedById ?? null,
        userId: session.userId,
        priorSelfReturns: Number(selfReturnCounts[0]?.count ?? 0),
      });

    const id = `trr_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    if (selfReturnAllowed && line && slot && latestScan) {
      const restoredCurrent = Math.min(current + 1, beginning);
      const ticketsSold = Math.max(beginning - restoredCurrent, 0);
      const salesAmount = ticketsSold * Number(pack.game.price);

      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const updateResult = await tx.pack.updateMany({
          where: {
            id: pack.id,
            status: { in: ["ACTIVE", "SOLD_OUT"] },
            currentTicketNumber: pack.currentTicketNumber,
          },
          data: { status: "ACTIVE", currentTicketNumber: restoredCurrent, completedAt: null },
        });
        if (updateResult.count !== 1) throw new Error("RETURN_CONFLICT");

        const deletedEvents = await tx.$executeRawUnsafe(
          `DELETE FROM live_scan_events WHERE id = $1 AND store_id = $2 AND shift_id = $3 AND pack_id = $4`,
          latestScan.id,
          session.storeId,
          shiftId,
          packId
        );
        if (deletedEvents !== 1) throw new Error("RETURN_CONFLICT");

        await tx.shiftLine.update({
          where: { id: line.id },
          data: { beginningTicket: beginning, endingTicket: restoredCurrent, ticketsSold, salesAmount },
        });
        await tx.displaySlot.update({ where: { id: slot.id }, data: { packId: pack.id } });
        await tx.$executeRawUnsafe(
          `
          INSERT INTO ticket_return_requests
            (id, store_id, shift_id, pack_id, ticket_barcode, status, reason,
             requested_by_id, requested_by_name, resolved_at, resolved_by_id, resolved_by_name)
          VALUES ($1, $2, $3, $4, $5, 'APPROVED_SELF', $6, $7, $8, NOW(), $7, $8)
          `,
          id,
          session.storeId,
          shiftId,
          packId,
          ticketBarcode,
          reason,
          session.userId,
          session.name
        );
        await tx.scanLogEntry.create({
          data: {
            storeId: session.storeId,
            action: "RETURNED",
            packId: pack.id,
            performedById: session.userId,
            detail: `Employee self-returned latest ticket ${ticketBarcode} for pack ${pack.serialNumber}. Restored to slot ${line.slotNumber}. Reason: ${reason}`,
          },
        });
      });

      await createInventoryNotification({
        storeId: session.storeId,
        type: "EMPLOYEE_TICKET_SELF_RETURN",
        entityId: id,
        title: "Employee returned a declined ticket",
        detail: `${session.name} returned ticket ${ticketBarcode} from pack ${pack.serialNumber} to slot ${line.slotNumber}.`,
        severity: "MEDIUM",
      }).catch((error) => console.error("[ticket self-return notification]", error));

      return NextResponse.json({
        success: true,
        mode: "self-approved",
        id,
        currentTicketNumber: restoredCurrent,
        ticketsSold,
        salesAmount,
      });
    }

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
