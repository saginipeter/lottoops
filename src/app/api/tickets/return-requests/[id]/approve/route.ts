import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiSession } from "@/lib/api-session";
import { isManagerOrAbove } from "@/lib/permissions";

interface RequestRow {
  id: string;
  storeId: string;
  shiftId: string;
  packId: string;
}

/**
 * POST /api/tickets/return-requests/[id]/approve
 * Manager approves an employee's ticket return request: restores the
 * ticket to the display for resale and marks the request approved.
 */
export async function POST(
  _req: NextRequest,
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

  const { id } = await params;

  try {
    const rows = (
      session.role === "OWNER"
        ? ((await prisma.$queryRawUnsafe(
            `
            SELECT r.id, r.store_id AS "storeId", r.shift_id AS "shiftId", r.pack_id AS "packId"
            FROM ticket_return_requests r
            JOIN stores ON stores.id = r.store_id
            WHERE r.id = $1 AND r.status = 'PENDING' AND stores."ownerUserId" = $2
            LIMIT 1
            `,
            id,
            session.userId
          )) as RequestRow[])
        : ((await prisma.$queryRawUnsafe(
            `
            SELECT id, store_id AS "storeId", shift_id AS "shiftId", pack_id AS "packId"
            FROM ticket_return_requests
            WHERE id = $1 AND store_id = $2 AND status = 'PENDING'
            LIMIT 1
            `,
            id,
            session.storeId
          )) as RequestRow[])
    );

    const request = rows[0];
    if (!request) {
      return NextResponse.json({ error: "Return request not found or already resolved." }, { status: 404 });
    }

    const shift = await prisma.shift.findFirst({
      where: { id: request.shiftId, storeId: request.storeId },
      include: { lines: { where: { packId: request.packId }, take: 1 } },
    });

    if (!shift || shift.lines.length === 0) {
      return NextResponse.json({ error: "No shift line found for this pack." }, { status: 400 });
    }

    const line = shift.lines[0];
    const pack = await prisma.pack.findFirst({
      where: { id: request.packId, storeId: request.storeId },
      select: {
        id: true,
        status: true,
        serialNumber: true,
        currentTicketNumber: true,
        game: { select: { price: true } },
      },
    });

    if (!pack) {
      return NextResponse.json({ error: "Pack not found." }, { status: 404 });
    }
    if (pack.status !== "ACTIVE" && pack.status !== "SOLD_OUT") {
      return NextResponse.json(
        { error: "Only ACTIVE or SOLD_OUT packs can be returned." },
        { status: 409 }
      );
    }

    const beginning = Number(line.beginningTicket ?? 0);
    const current = Number(pack.currentTicketNumber ?? beginning);
    if (current >= beginning) {
      return NextResponse.json(
        { error: "No recent sale to reverse for this pack." },
        { status: 409 }
      );
    }

    const restoredCurrent = Math.min(current + 1, beginning);
    const ticketsSold = Math.max(beginning - restoredCurrent, 0);

    const slot = await prisma.displaySlot.findFirst({
      where: { storeId: request.storeId, slotNumber: line.slotNumber },
      select: { id: true, packId: true },
    });

    if (!slot) {
      return NextResponse.json(
        { error: `Original slot ${line.slotNumber} was not found.` },
        { status: 404 }
      );
    }
    if (slot.packId && slot.packId !== pack.id) {
      return NextResponse.json(
        { error: `Original slot ${line.slotNumber} is occupied. Clear it before returning this pack.` },
        { status: 409 }
      );
    }

    const salesAmount = ticketsSold * Number(pack.game.price);

    await prisma.$transaction([
      prisma.pack.update({
        where: { id: pack.id },
        data: {
          status: "ACTIVE",
          currentTicketNumber: restoredCurrent,
          completedAt: null,
        },
      }),
      prisma.$executeRawUnsafe(
        `
        DELETE FROM live_scan_events
        WHERE id IN (
          SELECT id
          FROM live_scan_events
          WHERE store_id = $1
            AND shift_id = $2
            AND pack_id = $3
          ORDER BY scanned_at DESC
          LIMIT 1
        )
        `,
        request.storeId,
        shift.id,
        pack.id
      ),
      prisma.shiftLine.update({
        where: { id: line.id },
        data: {
          endingTicket: restoredCurrent,
          ticketsSold,
          salesAmount,
        },
      }),
      prisma.displaySlot.update({
        where: { id: slot.id },
        data: { packId: pack.id },
      }),
      prisma.scanLogEntry.create({
        data: {
          storeId: request.storeId,
          action: "RETURNED",
          packId: pack.id,
          performedById: session.userId,
          detail: `Manager approved customer-rejected return for pack ${pack.serialNumber}. Restored to slot ${line.slotNumber}.`,
        },
      }),
      prisma.$executeRawUnsafe(
        `
        UPDATE ticket_return_requests
        SET status = 'APPROVED', resolved_at = NOW(), resolved_by_id = $2, resolved_by_name = $3
        WHERE id = $1
        `,
        request.id,
        session.userId,
        session.name
      ),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[POST /api/tickets/return-requests/[id]/approve]", error);
    return NextResponse.json({ error: "Unable to approve return request." }, { status: 500 });
  }
}
