import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiSession } from "@/lib/api-session";
import { isManagerOrAbove } from "@/lib/permissions";
import { logCorrection } from "@/lib/correction-log";
import { getDisplayedTicketNumber } from "@/lib/tv-display";
import { remainingTicketsFromPhysicalTicket } from "@/lib/core-validation";

export async function POST(req: NextRequest) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!isManagerOrAbove(session)) return NextResponse.json({ error: "Manager authorization is required." }, { status: 403 });
  if (!prisma) return NextResponse.json({ error: "Database not connected" }, { status: 503 });

  try {
    const body = await req.json();
    const packId = typeof body.packId === "string" ? body.packId : "";
    const direction = body.direction === "LAST" ? "LAST" : body.direction === "FIRST" ? "FIRST" : null;
    const requestedPhysical = body.physicalTicketNumber === undefined ? undefined : Number(body.physicalTicketNumber);
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (!packId || !direction) return NextResponse.json({ error: "packId and direction are required." }, { status: 400 });
    if (reason.length < 6) return NextResponse.json({ error: "A correction reason of at least 6 characters is required." }, { status: 400 });
    if (requestedPhysical !== undefined && (!Number.isInteger(requestedPhysical) || requestedPhysical < 0)) return NextResponse.json({ error: "Physical ticket must be a non-negative integer." }, { status: 400 });

    const pack = await prisma.pack.findFirst({
      where: { id: packId, storeId: session.storeId },
      select: { id: true, status: true, firstTicket: true, currentTicketNumber: true, ticketQuantity: true, firstOrLastTicket: true, game: { select: { ticketsPerPack: true } } },
    });
    if (!pack) return NextResponse.json({ error: "Pack not found." }, { status: 404 });
    if (pack.status !== "ACTIVE") return NextResponse.json({ error: "Only active packs can change direction." }, { status: 409 });

    const quantity = Number(pack.ticketQuantity ?? pack.game.ticketsPerPack ?? 0);
    const firstTicket = Number(pack.firstTicket ?? 1);
    const oldDirection = pack.firstOrLastTicket === "LAST" ? "LAST" : "FIRST";
    const physicalTicket = requestedPhysical ?? getDisplayedTicketNumber(firstTicket, Number(pack.currentTicketNumber ?? quantity), quantity, oldDirection);
    const remaining = remainingTicketsFromPhysicalTicket(firstTicket, quantity, physicalTicket, direction);
    if (remaining === null) return NextResponse.json({ error: `Ticket ${physicalTicket} is outside this pack's valid range.` }, { status: 400 });

    await prisma.pack.update({ where: { id: pack.id }, data: { firstOrLastTicket: direction, currentTicketNumber: remaining } });
    await logCorrection({ storeId: session.storeId, entityType: "PACK", entityId: pack.id, fieldName: "firstOrLastTicket", oldValue: oldDirection, newValue: direction, reason, correctedById: session.userId, correctedByName: session.name });
    return NextResponse.json({ success: true, direction, physicalTicketNumber: physicalTicket, remainingTicketCount: remaining });
  } catch (error) {
    console.error("[POST /api/packs/update-direction]", error);
    return NextResponse.json({ error: "Unable to update ticket direction." }, { status: 500 });
  }
}
