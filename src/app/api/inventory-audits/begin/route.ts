import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getApiSession } from "@/lib/api-session";
import { recordShiftParticipant } from "@/lib/shift-participants";
import { getAuditPhysicalTicket, getSafeCurrentTicket } from "@/lib/ticket-quantity";

interface ActiveDisplayPack {
  slotNumber: string;
  packId: string | null;
  pack: {
    id: string;
    currentTicketNumber: number | null;
    firstTicket: number | null;
    ticketQuantity: number | null;
    firstOrLastTicket: string | null;
    game: { ticketsPerPack: number | null };
  } | null;
}

export async function POST(request: NextRequest) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (session.role === "AUDITOR") return NextResponse.json({ error: "Auditor accounts are read-only." }, { status: 403 });
  if (!prisma) return NextResponse.json({ error: "Database not connected" }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const shiftId = typeof body?.shiftId === "string" ? body.shiftId.trim() : "";
  if (!shiftId) return NextResponse.json({ error: "shiftId is required." }, { status: 400 });
  if ((session.role === "EMPLOYEE" || session.role === "SHIFT_LEAD") && session.shiftId !== shiftId) {
    return NextResponse.json({ error: "You can only audit the numbered shift assigned to your current session." }, { status: 403 });
  }

  try {
    const audit = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const lockedShift = await tx.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT id FROM shifts WHERE id = $1 AND "storeId" = $2 AND status = 'OPEN' FOR UPDATE`,
        shiftId, session.storeId,
      );
      if (lockedShift.length === 0) throw new Error("OPEN_SHIFT_NOT_FOUND");
      const existing = await tx.inventoryAudit.findUnique({ where: { shiftId }, select: { id: true } });
      if (existing) throw new Error("AUDIT_ALREADY_STARTED");

      // Match ticket sales, returns and close: lock the shift before shared packs.
      await tx.$queryRawUnsafe(`
        SELECT p.id FROM packs p
        JOIN display_slots d ON d."packId" = p.id
        WHERE p."storeId" = $1 AND p.status = 'ACTIVE'
        ORDER BY p.id FOR UPDATE OF p
      `, session.storeId);
      const displaySlots = await tx.displaySlot.findMany({
        where: { storeId: session.storeId, pack: { status: "ACTIVE" } },
        select: {
          slotNumber: true,
          packId: true,
          pack: { select: { id: true, currentTicketNumber: true, firstTicket: true, ticketQuantity: true, firstOrLastTicket: true, game: { select: { ticketsPerPack: true } } } },
        },
      }) as ActiveDisplayPack[];

      const packs = displaySlots.filter((slot) => slot.packId && slot.pack);
      const createdAudit = await tx.inventoryAudit.create({
        data: {
          storeId: session.storeId,
          shiftId,
          begunById: session.userId,
          lines: {
            create: packs.map((slot) => ({
              packId: slot.packId as string,
              slotNumber: slot.slotNumber,
              expectedTicket: getAuditPhysicalTicket({
                currentTicketNumber: slot.pack!.currentTicketNumber,
                firstTicket: slot.pack!.firstTicket,
                ticketQuantity: slot.pack!.ticketQuantity ?? slot.pack!.game.ticketsPerPack,
                firstOrLastTicket: slot.pack!.firstOrLastTicket,
              }),
            })),
          },
        },
        include: { lines: true },
      });
      if (packs.length > 0) {
        await tx.shiftLine.createMany({
          data: packs.map((slot) => ({
            shiftId,
            packId: slot.packId as string,
            slotNumber: slot.slotNumber,
            beginningTicket: getSafeCurrentTicket({
              currentTicketNumber: slot.pack!.currentTicketNumber,
              firstTicket: slot.pack!.firstTicket,
              ticketQuantity: slot.pack!.ticketQuantity ?? slot.pack!.game.ticketsPerPack,
            }),
          })),
          skipDuplicates: true,
        });
      }
      return createdAudit;
    }, { isolationLevel: "Serializable" });

    await recordShiftParticipant(shiftId, session.userId);
    return NextResponse.json(audit, { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "OPEN_SHIFT_NOT_FOUND") return NextResponse.json({ error: "Open shift not found." }, { status: 404 });
    if (code === "AUDIT_ALREADY_STARTED") return NextResponse.json({ error: "An audit has already been started for this shift. Refresh the page." }, { status: 409 });
    console.error("[POST /api/inventory-audits/begin]", error);
    return NextResponse.json({ error: "Unable to begin inventory audit." }, { status: 409 });
  }
}
