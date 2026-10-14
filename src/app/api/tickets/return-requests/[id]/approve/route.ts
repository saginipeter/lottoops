import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiSession } from "@/lib/api-session";
import { isManagerOrAbove } from "@/lib/permissions";
import { Prisma } from "@prisma/client";

interface RequestRow {
  id: string;
  storeId: string;
  shiftId: string;
  packId: string;
  status: string;
}

/**
 * POST /api/tickets/return-requests/[id]/approve
 * Resolve an already-returned ticket's review, or restore a legacy pending return.
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
            SELECT r.id, r.status, r.store_id AS "storeId", r.shift_id AS "shiftId", r.pack_id AS "packId"
            FROM ticket_return_requests r
            JOIN stores ON stores.id = r.store_id
            WHERE r.id = $1 AND r.status IN ('PENDING', 'RETURNED_PENDING_REVIEW') AND stores."ownerUserId" = $2
            LIMIT 1
            `,
            id,
            session.userId
          )) as RequestRow[])
        : ((await prisma.$queryRawUnsafe(
            `
            SELECT id, status, store_id AS "storeId", shift_id AS "shiftId", pack_id AS "packId"
            FROM ticket_return_requests
            WHERE id = $1 AND store_id = $2 AND status IN ('PENDING', 'RETURNED_PENDING_REVIEW')
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
    if (request.status === "RETURNED_PENDING_REVIEW") {
      const resolved = await prisma.$executeRawUnsafe(`
        UPDATE ticket_return_requests
        SET status = 'RETURN_REVIEW_APPROVED', resolved_at = NOW(), resolved_by_id = $2, resolved_by_name = $3
        WHERE id = $1 AND store_id = $4 AND status = 'RETURNED_PENDING_REVIEW'
      `, request.id, session.userId, session.name, request.storeId);
      if (resolved !== 1) {
        return NextResponse.json({ error: "Return request already resolved." }, { status: 409 });
      }
      return NextResponse.json({ success: true, mode: "review-only" });
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

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const claimed = await tx.$executeRawUnsafe(`
        UPDATE ticket_return_requests
        SET status = 'APPROVED', resolved_at = NOW(), resolved_by_id = $2, resolved_by_name = $3
        WHERE id = $1 AND store_id = $4 AND status = 'PENDING'
      `, request.id, session.userId, session.name, request.storeId);
      if (claimed !== 1) throw new Error("RETURN_CONFLICT");
      const updated = await tx.pack.updateMany({
        where: { id: pack.id, storeId: request.storeId, currentTicketNumber: pack.currentTicketNumber, status: pack.status },
        data: {
          status: "ACTIVE",
          currentTicketNumber: restoredCurrent,
          completedAt: null,
        },
      });
      if (updated.count !== 1) throw new Error("RETURN_CONFLICT");
      await tx.$executeRawUnsafe(
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
      );
      await tx.shiftLine.update({
        where: { id: line.id },
        data: {
          endingTicket: restoredCurrent,
          ticketsSold,
          salesAmount,
        },
      });
      const updatedSlot = await tx.displaySlot.updateMany({
        where: { id: slot.id, storeId: request.storeId, packId: slot.packId },
        data: { packId: pack.id },
      });
      if (updatedSlot.count !== 1) throw new Error("RETURN_CONFLICT");
      await tx.scanLogEntry.create({
        data: {
          storeId: request.storeId,
          action: "RETURNED",
          packId: pack.id,
          performedById: session.userId,
          detail: `Manager approved customer-rejected return for pack ${pack.serialNumber}. Restored to slot ${line.slotNumber}.`,
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "RETURN_CONFLICT") {
      return NextResponse.json({ error: "Return request or inventory changed. Refresh before trying again." }, { status: 409 });
    }
    console.error("[POST /api/tickets/return-requests/[id]/approve]", error);
    return NextResponse.json({ error: "Unable to approve return request." }, { status: 500 });
  }
}
