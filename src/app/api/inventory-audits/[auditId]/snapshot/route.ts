import { NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";
import { calculatePhysicalAuditVariance } from "@/lib/core-validation";
import { getAuditPhysicalTicket } from "@/lib/ticket-quantity";
import { compareDisplayNumberLabels } from "@/lib/display-number-order";

interface AuditSnapshotLine {
  packId: string;
  slotNumber: string;
  expectedTicket: number;
  beginningPhysicalTicket: number | null;
  endingPhysicalTicket: number | null;
}

interface ActiveDisplaySlot {
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
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ auditId: string }> },
) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (session.role === "AUDITOR") return NextResponse.json({ error: "Auditor accounts can access finalized reports only." }, { status: 403 });
  if (!prisma) return NextResponse.json({ error: "Database not connected" }, { status: 503 });

  const { auditId } = await params;
  if (!auditId) return NextResponse.json({ error: "auditId is required." }, { status: 400 });

  try {
    const audit = await prisma.inventoryAudit.findFirst({
      where: { id: auditId, storeId: session.storeId },
      select: {
        id: true,
        status: true,
        begunAt: true,
        endedAt: true,
        begunBy: { select: { name: true } },
        endedBy: { select: { name: true } },
        shift: {
          select: {
            id: true,
            shiftNumber: true,
            status: true,
            openedAt: true,
            openedBy: { select: { name: true } },
          },
        },
        lines: { select: {
          packId: true,
          slotNumber: true,
          expectedTicket: true,
          beginningPhysicalTicket: true,
          endingPhysicalTicket: true,
        } },
      },
    }) as {
      id: string;
      status: string;
      begunAt: Date;
      endedAt: Date | null;
      begunBy: { name: string };
      endedBy: { name: string } | null;
      shift: { id: string; shiftNumber: number | null; status: string; openedAt: Date; openedBy: { name: string } };
      lines: AuditSnapshotLine[];
    } | null;

    if (!audit) return NextResponse.json({ error: "Audit not found." }, { status: 404 });
    if ((session.role === "EMPLOYEE" || session.role === "SHIFT_LEAD") && session.shiftId !== audit.shift.id) {
      return NextResponse.json({ error: "You can only print an audit snapshot for your assigned numbered shift." }, { status: 403 });
    }
    if (audit.shift.status !== "OPEN") {
      return NextResponse.json({ error: "This shift is closed; use its finalized shift report." }, { status: 409 });
    }

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
    }) as ActiveDisplaySlot[];

    const linesByPack = new Map(audit.lines.map((line) => [line.packId, line]));
    const generatedAt = new Date();
    const activePacks = displaySlots.flatMap((slot) => {
      if (!slot.pack || !slot.packId) return [];
      const line = linesByPack.get(slot.packId);
      const currentExpectedTicket = getAuditPhysicalTicket({
        currentTicketNumber: slot.pack.currentTicketNumber,
        firstTicket: slot.pack.firstTicket,
        ticketQuantity: slot.pack.ticketQuantity ?? slot.pack.game.ticketsPerPack,
        firstOrLastTicket: slot.pack.firstOrLastTicket,
      });
      const observed = line?.endingPhysicalTicket ?? null;
      return [{
        display: slot.slotNumber,
        pack: slot.pack.serialNumber,
        game: slot.pack.game.name,
        direction: slot.pack.firstOrLastTicket === "LAST" ? "LAST" : "FIRST",
        openingExpectedTicket: line?.expectedTicket ?? null,
        openingPhysicalTicket: line?.beginningPhysicalTicket ?? null,
        currentExpectedTicket,
        closingPhysicalTicket: observed,
        provisionalVariance: observed == null ? null : calculatePhysicalAuditVariance(currentExpectedTicket, observed),
        scanStatus: !line
          ? "Audit line not recorded"
          : line.beginningPhysicalTicket == null
            ? "Opening scan needed"
            : observed == null
              ? "Closing scan needed"
              : "Scanned; provisional",
      }];
    }).sort((left, right) => compareDisplayNumberLabels(left.display, right.display) || left.pack.localeCompare(right.pack, undefined, { numeric: true }));

    return NextResponse.json({
      generatedAt: generatedAt.toISOString(),
      storeName: session.storeName,
      shift: {
        id: audit.shift.id,
        shiftNumber: audit.shift.shiftNumber,
        status: audit.shift.status,
        openedAt: audit.shift.openedAt.toISOString(),
        openedBy: audit.shift.openedBy.name,
      },
      audit: {
        id: audit.id,
        status: audit.status,
        begunAt: audit.begunAt.toISOString(),
        begunBy: audit.begunBy.name,
        endedAt: audit.endedAt?.toISOString() ?? null,
        endedBy: audit.endedBy?.name ?? null,
      },
      activeDisplayCount: activePacks.length,
      activePacks,
    }, { headers: { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache" } });
  } catch (error) {
    console.error("[GET /api/inventory-audits/:auditId/snapshot]", error);
    return NextResponse.json({ error: "Unable to load audit snapshot." }, { status: 500 });
  }
}
