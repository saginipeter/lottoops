import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logInventoryActivity } from "@/lib/activity-log";
import { getApiSession } from "@/lib/api-session";
import { createInventoryNotification } from "@/lib/inventory-notifications";
import { getAuditPhysicalTicket } from "@/lib/ticket-quantity";

interface AuditLine {
  id: string;
  packId: string;
  expectedTicket: number;
  endingExpectedTicket: number | null;
  beginningPhysicalTicket: number | null;
  endingPhysicalTicket: number | null;
}

export async function POST(request: NextRequest) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!prisma) return NextResponse.json({ error: "Database not connected" }, { status: 503 });

  const { auditId } = await request.json().catch(() => ({}));
  if (!auditId || typeof auditId !== "string") {
    return NextResponse.json({ error: "auditId is required." }, { status: 400 });
  }

  try {
    const audit = await prisma.inventoryAudit.findFirst({
      where: { id: auditId, storeId: session.storeId, status: "OPEN", shift: { status: "OPEN" } },
      include: { lines: true },
    });
    if (!audit) return NextResponse.json({ error: "Open audit not found." }, { status: 404 });

    const auditLines = audit.lines as AuditLine[];
    const incomplete = auditLines.filter((line) => line.beginningPhysicalTicket === null || line.endingPhysicalTicket === null);
    if (incomplete.length > 0) {
      return NextResponse.json({ error: `${incomplete.length} display pack audit scan(s) are still required.` }, { status: 409 });
    }

    const currentLines = (await prisma.shiftLine.findMany({ where: { shiftId: audit.shiftId }, include: { pack: { select: { currentTicketNumber: true, firstTicket: true, ticketQuantity: true } } } })) as Array<{
      packId: string;
      endingTicket: number | null;
      pack: { currentTicketNumber: number | null; firstTicket: number | null; ticketQuantity: number | null };
    }>;
    const resolvedLines = auditLines.map((line) => {
      const shiftLine = currentLines.find((item) => item.packId === line.packId);
      const expected = shiftLine
        ? getAuditPhysicalTicket({
            currentTicketNumber: shiftLine.pack.currentTicketNumber ?? shiftLine.endingTicket,
            firstTicket: shiftLine.pack.firstTicket,
            ticketQuantity: shiftLine.pack.ticketQuantity,
          })
        : line.expectedTicket;
      return { line, expected, variance: Number(line.endingPhysicalTicket) - expected };
    });
    const auditUpdates = resolvedLines.map(({ line, expected, variance }) =>
      prisma.inventoryAuditLine.update({
        where: { id: line.id },
        data: { endingExpectedTicket: expected, variance },
      })
    );
    await prisma.$transaction([
      ...auditUpdates,
      prisma.inventoryAudit.update({ where: { id: audit.id }, data: { status: "COMPLETED", endedById: session.userId, endedAt: new Date() } }),
    ]);

    await logInventoryActivity({
      storeId: session.storeId,
      action: "ENDING_AUDIT_COMPLETED",
      entityType: "SHIFT",
      entityId: audit.shiftId,
      detail: `Ending inventory audit completed with ${resolvedLines.filter(({ variance }) => variance !== 0).length} variance(s).`,
      performedById: session.userId,
      performedByName: session.name,
    });
    const varianceLines = resolvedLines.filter(({ variance }) => variance !== 0);
    await Promise.all(varianceLines.map(({ line, expected }) => createInventoryNotification({
      storeId: session.storeId,
      type: "INVENTORY_AUDIT_VARIANCE",
      entityId: line.id,
      title: "Physical audit variance requires review",
      detail: `Pack ${line.packId}: expected physical ticket ${expected}, observed ${line.endingPhysicalTicket}.`,
      severity: "URGENT",
    })));
    return NextResponse.json({ success: true, auditId: audit.id });
  } catch (error) {
    console.error("[POST /api/inventory-audits/end]", error);
    return NextResponse.json({ error: "Unable to complete inventory audit." }, { status: 500 });
  }
}
