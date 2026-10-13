import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiSession } from "@/lib/api-session";
import { getAuditPhysicalTicket } from "@/lib/ticket-quantity";

export async function POST(request: NextRequest) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!prisma) return NextResponse.json({ error: "Database not connected" }, { status: 503 });

  const { shiftId } = await request.json().catch(() => ({}));
  if (!shiftId || typeof shiftId !== "string") {
    return NextResponse.json({ error: "shiftId is required." }, { status: 400 });
  }

  try {
    const shift = await prisma.shift.findFirst({
      where: { id: shiftId, storeId: session.storeId, status: "OPEN" },
      select: { id: true, inventoryAudit: { select: { id: true } } },
    });
    if (!shift) return NextResponse.json({ error: "Open shift not found." }, { status: 404 });
    if (shift.inventoryAudit) {
      return NextResponse.json({ error: "An audit has already been started for this shift. Refresh the page." }, { status: 409 });
    }

    // Audit every pack currently on a display, including packs activated after
    // the shift opened (those have no shift line yet).
    const displaySlots: Array<{
      slotNumber: string;
      packId: string | null;
      pack: {
        currentTicketNumber: number | null;
        firstTicket: number | null;
        ticketQuantity: number | null;
        firstOrLastTicket: string | null;
        game: { ticketsPerPack: number | null };
      } | null;
    }> = await prisma.displaySlot.findMany({
      where: { storeId: session.storeId, pack: { status: "ACTIVE" } },
      select: {
        slotNumber: true,
        packId: true,
        pack: { select: { currentTicketNumber: true, firstTicket: true, ticketQuantity: true, firstOrLastTicket: true, game: { select: { ticketsPerPack: true } } } },
      },
    });

    const audit = await prisma.inventoryAudit.create({
      data: {
        storeId: session.storeId,
        shiftId: shift.id,
        begunById: session.userId,
        lines: {
          create: displaySlots
            .filter((slot) => slot.packId && slot.pack)
            .map((slot) => ({
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
    return NextResponse.json(audit, { status: 201 });
  } catch (error) {
    console.error("[POST /api/inventory-audits/begin]", error);
    return NextResponse.json({ error: "Unable to begin inventory audit." }, { status: 409 });
  }
}
