import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiSession } from "@/lib/api-session";
import { logInventoryActivity } from "@/lib/activity-log";
import { isManagerOrAbove } from "@/lib/permissions";
import { logCorrection } from "@/lib/correction-log";
import { canAuthorizeCorrection } from "@/lib/control-validation";

export async function POST(req: NextRequest) {
  const session = await getApiSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!canAuthorizeCorrection(session.role) || !isManagerOrAbove(session)) {
    return NextResponse.json(
      { error: "Manager authorization is required to correct a ticket number." },
      { status: 403 }
    );
  }

  if (!prisma) {
    return NextResponse.json({ error: "Database not connected" }, { status: 503 });
  }

  try {
    const { packId, currentTicketNumber, reason } = await req.json();

    if (!packId || typeof packId !== "string") {
      return NextResponse.json({ error: "packId is required." }, { status: 400 });
    }

    if (!Number.isInteger(currentTicketNumber) || currentTicketNumber < 0) {
      return NextResponse.json(
        { error: "currentTicketNumber must be a non-negative integer." },
        { status: 400 }
      );
    }
    if (typeof reason !== "string" || reason.trim().length < 6) {
      return NextResponse.json({ error: "A correction reason of at least 6 characters is required." }, { status: 400 });
    }

    const pack = await prisma.pack.findFirst({
      where: { id: packId, storeId: session.storeId },
      select: { id: true, status: true, firstTicket: true, currentTicketNumber: true },
    });

    if (!pack) {
      return NextResponse.json({ error: "Pack not found." }, { status: 404 });
    }

    if (pack.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Only ACTIVE packs can have current ticket updated." },
        { status: 409 }
      );
    }

    if (pack.firstTicket !== null && currentTicketNumber > pack.firstTicket) {
      return NextResponse.json(
        { error: `Current ticket cannot be greater than first ticket (${pack.firstTicket}).` },
        { status: 400 }
      );
    }

    await prisma.pack.update({
      where: { id: pack.id },
      data: { currentTicketNumber },
    });

    await logCorrection({
      storeId: session.storeId,
      entityType: "PACK",
      entityId: pack.id,
      fieldName: "currentTicketNumber",
      oldValue: pack.currentTicketNumber ?? pack.firstTicket,
      newValue: currentTicketNumber,
      reason: reason.trim(),
      correctedById: session.userId,
      correctedByName: session.name,
    });

    await logInventoryActivity({
      storeId: session.storeId,
      action: "UPDATE_TICKET_NUMBER",
      entityType: "PACK",
      entityId: pack.id,
      detail: `Updated current ticket for pack ${packId} from ${pack.currentTicketNumber ?? pack.firstTicket ?? "N/A"} to ${currentTicketNumber}. Reason: ${reason.trim()}`,
      performedById: session.userId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[POST /api/packs/update-ticket]", error);
    return NextResponse.json({ error: "Unable to update current ticket." }, { status: 500 });
  }
}
