import { NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";
import { getAuditPhysicalTicket } from "@/lib/ticket-quantity";

type AuditLineRecord = {
  id: string;
  packId: string;
  expectedTicket: number;
  endingExpectedTicket: number | null;
  beginningPhysicalTicket: number | null;
  endingPhysicalTicket: number | null;
  variance: number | null;
  pack: { serialNumber: string; game: { name: string } } | null;
};

type DisplaySlotRecord = {
  slotNumber: string;
  packId: string | null;
  pack: {
    id: string;
    serialNumber: string;
    currentTicketNumber: number | null;
    firstTicket: number | null;
    ticketQuantity: number | null;
    firstOrLastTicket: string | null;
    game: { name: string; ticketsPerPack: number | null };
  } | null;
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ auditId: string }> },
) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!prisma) return NextResponse.json({ error: "Database not connected" }, { status: 503 });

  const { auditId } = await params;
  if (!auditId) return NextResponse.json({ error: "auditId is required." }, { status: 400 });

  try {
    const audit = await prisma.inventoryAudit.findFirst({
      where: { id: auditId, storeId: session.storeId },
      select: {
        id: true,
        status: true,
        shiftId: true,
        lines: {
          include: { pack: { select: { serialNumber: true, game: { select: { name: true } } } } },
        },
      },
    }) as { id: string; status: string; shiftId: string; lines: AuditLineRecord[] } | null;
    if (!audit) return NextResponse.json({ error: "Audit not found." }, { status: 404 });

    const displaySlots = await prisma.displaySlot.findMany({
      where: { storeId: session.storeId, pack: { status: "ACTIVE" } },
      select: {
        slotNumber: true,
        packId: true,
        pack: {
          select: {
            id: true,
            serialNumber: true,
            currentTicketNumber: true,
            firstTicket: true,
            ticketQuantity: true,
            firstOrLastTicket: true,
            game: { select: { name: true, ticketsPerPack: true } },
          },
        },
      },
      orderBy: { slotNumber: "asc" },
    }) as DisplaySlotRecord[];

    const lineByPack = new Map(audit.lines.map((line) => [line.packId, line]));
    const activePacks = displaySlots.flatMap((slot) => {
      if (!slot.pack || !slot.packId) return [];
      const line = lineByPack.get(slot.packId);
      const expectedTicket = getAuditPhysicalTicket({
        currentTicketNumber: slot.pack.currentTicketNumber,
        firstTicket: slot.pack.firstTicket,
        ticketQuantity: slot.pack.ticketQuantity ?? slot.pack.game.ticketsPerPack,
        firstOrLastTicket: slot.pack.firstOrLastTicket,
      });
      return [{
        packId: slot.packId,
        slotNumber: slot.slotNumber,
        serialNumber: slot.pack.serialNumber,
        gameName: slot.pack.game.name,
        currentTicketNumber: slot.pack.currentTicketNumber,
        firstTicket: slot.pack.firstTicket,
        ticketQuantity: slot.pack.ticketQuantity,
        firstOrLastTicket: slot.pack.firstOrLastTicket,
        ticketsPerPack: slot.pack.game.ticketsPerPack,
        lineId: line?.id ?? null,
        expectedTicket: line?.expectedTicket ?? expectedTicket,
        endingExpectedTicket: line?.endingExpectedTicket ?? null,
        beginningPhysicalTicket: line?.beginningPhysicalTicket ?? null,
        endingPhysicalTicket: line?.endingPhysicalTicket ?? null,
        variance: line?.variance ?? null,
      }];
    });

    return NextResponse.json({
      audit: { id: audit.id, status: audit.status, shiftId: audit.shiftId },
      lines: audit.lines,
      activePacks,
      activeDisplayPackCount: activePacks.length,
      updatedAt: new Date().toISOString(),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[GET /api/inventory-audits/:auditId]", error);
    return NextResponse.json({ error: "Unable to load live audit status." }, { status: 500 });
  }
}
