import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getApiSession } from "@/lib/api-session";
import { isOwner } from "@/lib/permissions";
import { getSafeCurrentTicket } from "@/lib/ticket-quantity";

class ReverseSaleError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

type LatestSale = { id: string; shiftId: string; ticketBarcode: string };

export async function POST(req: NextRequest) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!isOwner(session)) return NextResponse.json({ error: "Only the store owner can correct or reverse a ticket." }, { status: 403 });
  if (!prisma) return NextResponse.json({ error: "Database not connected" }, { status: 503 });

  try {
    const body = await req.json().catch(() => ({}));
    const packId = typeof body?.packId === "string" ? body.packId.trim() : "";
    const pin = typeof body?.pin === "string" ? body.pin : "";
    let shiftId = typeof body?.shiftId === "string" ? body.shiftId.trim() : "";
    if (!packId) return NextResponse.json({ error: "packId is required." }, { status: 400 });
    if (!pin) return NextResponse.json({ error: "PIN is required." }, { status: 400 });

    const securityRows = await prisma.$queryRawUnsafe(
      `SELECT approval_pin_hash FROM store_security_settings WHERE store_id = $1 LIMIT 1`,
      session.storeId,
    ) as Array<{ approval_pin_hash: string }>;
    if (securityRows.length === 0) return NextResponse.json({ error: "Approval PIN not configured. Manager must set it in Settings first." }, { status: 409 });
    if (!await bcrypt.compare(pin, securityRows[0].approval_pin_hash)) return NextResponse.json({ error: "Invalid approval PIN." }, { status: 403 });

    if (!shiftId) {
      const openShifts: Array<{ id: string }> = await prisma.shift.findMany({
        where: { storeId: session.storeId, status: "OPEN" }, select: { id: true }, take: 2,
      });
      if (openShifts.length !== 1) {
        return NextResponse.json({ error: "Select the numbered shift for this reversal." }, { status: 409 });
      }
      shiftId = openShifts[0].id;
    }

    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Match live sales/returns/close: lock the numbered shift before the shared pack.
      const lockedShifts = await tx.$queryRawUnsafe<Array<{ id: string; shiftNumber: number | null }>>(
        `SELECT id, "shift_number" AS "shiftNumber" FROM shifts WHERE id = $1 AND "storeId" = $2 AND status = 'OPEN' FOR UPDATE`,
        shiftId, session.storeId,
      );
      if (lockedShifts.length === 0) throw new ReverseSaleError("The selected numbered shift is not open for this store.", 409);
      const lockedShift = lockedShifts[0];
      await tx.$queryRawUnsafe(
        `SELECT id FROM packs WHERE id = $1 AND "storeId" = $2 FOR UPDATE`,
        packId, session.storeId,
      );

      const line = await tx.shiftLine.findUnique({ where: { shiftId_packId: { shiftId, packId } } });
      if (!line) throw new ReverseSaleError("No open shift line found for this pack and numbered shift.", 400);
      const pack = await tx.pack.findFirst({
        where: { id: packId, storeId: session.storeId },
        select: {
          id: true, status: true, serialNumber: true, currentTicketNumber: true,
          firstTicket: true, ticketQuantity: true, firstOrLastTicket: true,
          ticketPrice: true, game: { select: { price: true, ticketsPerPack: true } },
        },
      });
      if (!pack) throw new ReverseSaleError("Pack not found.", 404);
      if (pack.status !== "ACTIVE" && pack.status !== "SOLD_OUT") {
        throw new ReverseSaleError("Only active packs or packs with no tickets remaining can be corrected.", 409);
      }

      const latestSales = await tx.$queryRawUnsafe<LatestSale[]>(
        `SELECT id, shift_id AS "shiftId", ticket_barcode AS "ticketBarcode"
         FROM live_scan_events
         WHERE store_id = $1 AND pack_id = $2
         ORDER BY scanned_at DESC, id DESC
         LIMIT 1 FOR UPDATE`,
        session.storeId, pack.id,
      );
      const latestSale = latestSales[0];
      if (!latestSale) throw new ReverseSaleError("No recent ticket tracking record to reverse for this pack.", 409);
      if (latestSale.shiftId !== shiftId) {
        throw new ReverseSaleError("The most recent ticket tracking record belongs to another numbered shift and cannot be reversed here.", 409);
      }
      if (!latestSale.ticketBarcode.startsWith(pack.serialNumber)) {
        throw new ReverseSaleError("The latest ticket tracking record does not match this pack's barcode.", 409);
      }

      const ticketQuantity = Number(pack.ticketQuantity ?? pack.game.ticketsPerPack ?? 0);
      const maxRemaining = ticketQuantity > 0
        ? Math.max(ticketQuantity - Math.max(Number(pack.firstTicket ?? 1), 1) + 1, 0)
        : 0;
      const rawCurrent = Number(pack.currentTicketNumber ?? 0);
      if (!Number.isSafeInteger(rawCurrent) || rawCurrent < 0 || rawCurrent >= maxRemaining) {
        throw new ReverseSaleError("The shared pack ticket count is inconsistent; ask a manager to reconcile it before reversing.", 409);
      }
      const restoredCurrent = rawCurrent + 1;
      const restoredSellable = getSafeCurrentTicket({
        currentTicketNumber: restoredCurrent,
        firstTicket: pack.firstTicket,
        ticketQuantity: pack.ticketQuantity ?? pack.game.ticketsPerPack,
      });
      if (restoredSellable !== restoredCurrent) throw new ReverseSaleError("The restored ticket count is outside this pack's range.", 409);

      const slot = await tx.displaySlot.findFirst({
        where: { storeId: session.storeId, slotNumber: line.slotNumber },
        select: { id: true, packId: true },
      });
      if (!slot) throw new ReverseSaleError(`Original display ${line.slotNumber} was not found.`, 404);
      await tx.$queryRawUnsafe(`SELECT id FROM display_slots WHERE id = $1 FOR UPDATE`, slot.id);
      if (slot.packId && slot.packId !== pack.id) {
        const occupyingPack = await tx.pack.findFirst({ where: { id: slot.packId, storeId: session.storeId }, select: { status: true } });
        if (occupyingPack?.status === "ACTIVE") {
          throw new ReverseSaleError(`Original display ${line.slotNumber} is occupied. Clear it before returning this pack.`, 409);
        }
      }

      const deleted = await tx.$executeRawUnsafe(
        `DELETE FROM live_scan_events WHERE id = $1 AND store_id = $2 AND shift_id = $3 AND pack_id = $4`,
        latestSale.id, session.storeId, shiftId, pack.id,
      );
      if (deleted !== 1) throw new ReverseSaleError("The latest ticket tracking record changed before it could be reversed. Refresh and try again.", 409);
      const remainingRows = await tx.$queryRawUnsafe<Array<{ ticketsSold: number | bigint }>>(
        `SELECT COUNT(*)::int AS "ticketsSold" FROM live_scan_events WHERE store_id = $1 AND shift_id = $2 AND pack_id = $3`,
        session.storeId, shiftId, pack.id,
      );
      const ticketsSold = Number(remainingRows[0]?.ticketsSold ?? 0);
      const beginning = Number(line.beginningTicket);
      const endingTicket = Math.max(beginning - ticketsSold, 0);
      const price = Number(pack.ticketPrice ?? pack.game.price ?? 0);
      const salesAmount = Math.round((ticketsSold * price + Number.EPSILON) * 100) / 100;

      const packUpdate = await tx.pack.updateMany({
        where: { id: pack.id, storeId: session.storeId, status: pack.status, currentTicketNumber: pack.currentTicketNumber },
        data: { status: "ACTIVE", currentTicketNumber: restoredCurrent, completedAt: null },
      });
      if (packUpdate.count !== 1) throw new ReverseSaleError("Pack state changed during reversal. Refresh and try again.", 409);
      await tx.shiftLine.update({ where: { id: line.id }, data: { endingTicket, ticketsSold, salesAmount } });
      await tx.displaySlot.update({ where: { id: slot.id }, data: { packId: pack.id } });
      await tx.scanLogEntry.create({
        data: {
          storeId: session.storeId,
          action: "RETURNED",
          packId: pack.id,
          performedById: session.userId,
          detail: `Rejected ticket tracking reversed for pack ${pack.serialNumber}. Restored to display ${line.slotNumber} on Shift ${lockedShift.shiftNumber ?? "unlabeled"}.`,
        },
      });
      return { packId: pack.id, shiftId, currentTicketNumber: restoredCurrent, slotNumber: line.slotNumber, ticketsSold, salesAmount };
    }, { isolationLevel: "Serializable" });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof ReverseSaleError) return NextResponse.json({ error: error.message }, { status: error.status });
    const code = error && typeof error === "object" && "code" in error ? String((error as { code?: unknown }).code) : "";
    if (code === "P2034") return NextResponse.json({ error: "Ticket tracking changed during reversal. Refresh and try again." }, { status: 409 });
    console.error("[POST /api/packs/reverse-sale]", error);
    return NextResponse.json({ error: "Unable to reverse the last ticket tracking record." }, { status: 500 });
  }
}
