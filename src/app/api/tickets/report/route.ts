import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiSession } from "@/lib/api-session";
import { recordShiftParticipant } from "@/lib/shift-participants";
import { logInventoryActivity } from "@/lib/activity-log";

export async function POST(request: NextRequest) {
  const session = await getApiSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!prisma) {
    return NextResponse.json({ error: "Database not connected" }, { status: 503 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const ticket = typeof body?.ticket === "string" ? body.ticket.trim() : "";
    const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
    const terminalId =
      typeof body?.terminalId === "string" && body.terminalId.trim()
        ? body.terminalId.trim().toUpperCase()
        : session.terminalId ?? "T1";
    const shiftId = typeof body?.shiftId === "string" ? body.shiftId.trim() : "";

    if ((session.role === "EMPLOYEE" || session.role === "SHIFT_LEAD") && shiftId !== session.shiftId) {
      return NextResponse.json({ error: "This report must use your assigned shift." }, { status: 403 });
    }

    const shift = shiftId ? await prisma.shift.findFirst({
      where: { id: shiftId, storeId: session.storeId },
      select: { shiftNumber: true, terminalId: true },
    }) : null;
    if (shiftId && !shift) return NextResponse.json({ error: "The selected shift was not found." }, { status: 404 });
    if (shift?.terminalId && session.terminalId && shift.terminalId !== session.terminalId) {
      return NextResponse.json({ error: "This report must use your assigned terminal." }, { status: 403 });
    }
    const reportTerminal = shift?.terminalId ?? session.terminalId ?? terminalId;
    const shiftLabel = shift ? (shift.shiftNumber == null ? "Shift number not recorded" : `Shift ${shift.shiftNumber}`) : null;

    if (!ticket) {
      return NextResponse.json({ error: "Ticket number or barcode is required." }, { status: 400 });
    }

    if (reason.length < 6) {
      return NextResponse.json({ error: "Reason must be at least 6 characters." }, { status: 400 });
    }

    const normalized = ticket.replace(/\D/g, "");
    const prefix = normalized.length >= 11 ? normalized.slice(0, 11) : "";

    const matchedPack = await prisma.pack.findFirst({
      where: {
        storeId: session.storeId,
        OR: [
          { serialNumber: ticket },
          { serialNumber: normalized },
          ...(prefix
            ? [{ gameNumber: prefix.slice(0, 4), packNumber: prefix.slice(4) }]
            : []),
        ],
      },
      select: {
        id: true,
        serialNumber: true,
        gameNumber: true,
        packNumber: true,
      },
    });

    const ticketLabel = matchedPack
      ? `${matchedPack.serialNumber} (G${matchedPack.gameNumber}-P${matchedPack.packNumber})`
      : ticket;

    await logInventoryActivity({
      storeId: session.storeId,
      action: "TICKET_REPORTED",
      entityType: "TICKET",
      entityId: matchedPack?.id,
      detail: `Ticket reported from ${reportTerminal}${shiftLabel ? ` during ${shiftLabel}` : ""}: ${ticketLabel}. Reason: ${reason}`,
      performedById: session.userId,
      performedByName: session.name,
    });
    if (shiftId) await recordShiftParticipant(shiftId, session.userId);

    return NextResponse.json({ success: true, matchedPackId: matchedPack?.id ?? null });
  } catch (error) {
    console.error("[POST /api/tickets/report]", error);
    return NextResponse.json({ error: "Unable to submit ticket report." }, { status: 500 });
  }
}
