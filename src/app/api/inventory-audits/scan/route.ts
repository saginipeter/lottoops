import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiSession } from "@/lib/api-session";
import { logInventoryActivity } from "@/lib/activity-log";
import { recordShiftParticipant } from "@/lib/shift-participants";
import { getAuditPhysicalTicket } from "@/lib/ticket-quantity";

interface AuditLine {
  id: string;
  packId: string;
  expectedTicket: number;
  beginningPhysicalTicket: number | null;
}

export async function POST(request: NextRequest) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!prisma) return NextResponse.json({ error: "Database not connected" }, { status: 503 });

  const { auditId, serialNumber, phase } = await request.json().catch(() => ({}));
  if (!auditId || !serialNumber || !["beginning", "ending"].includes(phase)) {
    return NextResponse.json({ error: "auditId, barcode, and phase are required." }, { status: 400 });
  }

  try {
    const audit = await prisma.inventoryAudit.findFirst({
      where: { id: auditId, storeId: session.storeId, status: "OPEN" },
      include: { lines: true },
    });
    if (!audit) return NextResponse.json({ error: "Open audit not found." }, { status: 404 });

    const barcode = String(serialNumber).trim().replace(/\D/g, "");
    if (!/^\d{14}$/.test(barcode)) {
      return NextResponse.json(
        { error: "Scan the complete 14-digit ticket barcode. The last 3 digits are recorded as the physical ticket." },
        { status: 400 }
      );
    }
    const normalized = barcode.slice(0, 11);
    const physicalTicket = Number(barcode.slice(11));
    const pack = await prisma.pack.findFirst({
      where: {
        storeId: session.storeId,
        serialNumber: normalized,
        status: "ACTIVE",
        slot: { isNot: null },
      },
      select: {
        id: true,
        currentTicketNumber: true,
        firstTicket: true,
        ticketQuantity: true,
        firstOrLastTicket: true,
        slot: { select: { slotNumber: true } },
        game: { select: { ticketsPerPack: true } },
      },
    });
    if (!pack) return NextResponse.json({ error: "Only active packs assigned to a display can be audited." }, { status: 404 });

    const expectedPhysicalTicket = getAuditPhysicalTicket({
      currentTicketNumber: pack.currentTicketNumber,
      firstTicket: pack.firstTicket,
      ticketQuantity: pack.ticketQuantity ?? pack.game.ticketsPerPack,
      firstOrLastTicket: pack.firstOrLastTicket,
    });

    let line = (audit.lines as AuditLine[]).find((item) => item.packId === pack.id);
    if (!line) {
      if (phase !== "beginning") {
        return NextResponse.json(
          { error: "Record this pack in the Opening Audit before its Closing Audit." },
          { status: 409 }
        );
      }
      line = await prisma.inventoryAuditLine.create({
        data: {
          auditId: audit.id,
          packId: pack.id,
          slotNumber: pack.slot?.slotNumber ?? "",
          expectedTicket: expectedPhysicalTicket,
        },
      });
    }
    if (!line) {
      return NextResponse.json({ error: "Unable to create an audit line for this pack." }, { status: 500 });
    }
    if (phase === "ending" && line.beginningPhysicalTicket === null) {
      return NextResponse.json(
        { error: "Record this pack in the Opening Audit before its Closing Audit." },
        { status: 409 }
      );
    }

    if (!Number.isInteger(physicalTicket) || physicalTicket < 0) {
      return NextResponse.json({ error: "Enter the physical ticket number shown on the pack." }, { status: 400 });
    }
    const ticketQuantity = Number(pack.ticketQuantity ?? pack.game.ticketsPerPack ?? 0);
    if (ticketQuantity > 0 && physicalTicket > ticketQuantity) {
      return NextResponse.json(
        { error: `Physical ticket must be between 0 and ${ticketQuantity}.` },
        { status: 400 }
      );
    }

    const data = phase === "beginning"
      ? { beginningPhysicalTicket: physicalTicket, expectedTicket: expectedPhysicalTicket }
      : {
          endingPhysicalTicket: physicalTicket,
          endingExpectedTicket: expectedPhysicalTicket,
          variance: physicalTicket - expectedPhysicalTicket,
        };
    const updated = await prisma.inventoryAuditLine.update({
      where: { id: line.id },
      data,
      include: { pack: { select: { serialNumber: true, game: { select: { name: true } } } } },
    });
    await recordShiftParticipant(audit.shiftId, session.userId);
    await logInventoryActivity({ storeId: session.storeId, action: phase === "beginning" ? "BEGINNING_AUDIT_SCAN" : "ENDING_AUDIT_SCAN", entityType: "PACK", entityId: pack.id, detail: `${phase} physical ticket recorded as ${physicalTicket} for audit ${auditId}.`, performedById: session.userId, performedByName: session.name });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("[POST /api/inventory-audits/scan]", error);
    return NextResponse.json({ error: "Unable to record audit scan." }, { status: 500 });
  }
}
