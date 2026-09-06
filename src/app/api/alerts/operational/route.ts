import { NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";
import { isManagerOrAbove } from "@/lib/permissions";

interface LowTicketPack { id: string; serialNumber: string; currentTicketNumber: number | null; slot: { slotNumber: string } | null; game: { name: string } }
interface OpenShift { id: string; openedAt: Date; openedBy: { name: string }; inventoryAudit: { id: string; status: string; lines: Array<{ beginningPhysicalTicket: number | null; endingPhysicalTicket: number | null }> } | null }
interface StaleShipment { id: string; invoiceNumber: string; createdAt: Date; expectedPacks: number }

export async function GET() {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!isManagerOrAbove(session)) return NextResponse.json({ error: "Manager access required." }, { status: 403 });
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  try {
    const [packsResult, shiftsResult, shipmentsResult] = await Promise.all([
      prisma.pack.findMany({
        where: { storeId: session.storeId, status: "ACTIVE", slot: { isNot: null }, currentTicketNumber: { lte: 5 } },
        select: { id: true, serialNumber: true, currentTicketNumber: true, slot: { select: { slotNumber: true } }, game: { select: { name: true } } },
        orderBy: { currentTicketNumber: "asc" },
      }),
      prisma.shift.findMany({
        where: { storeId: session.storeId, status: "OPEN" },
        select: { id: true, openedAt: true, openedBy: { select: { name: true } }, inventoryAudit: { select: { id: true, status: true, lines: { select: { beginningPhysicalTicket: true, endingPhysicalTicket: true } } } } },
      }),
      prisma.shipment.findMany({
        where: { storeId: session.storeId, status: "IN_PROGRESS", createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        select: { id: true, invoiceNumber: true, createdAt: true, expectedPacks: true },
        orderBy: { createdAt: "asc" },
      }),
    ]);
    const packs = packsResult as LowTicketPack[];
    const shifts = shiftsResult as OpenShift[];
    const shipments = shipmentsResult as StaleShipment[];

    const alerts = [
      ...packs.map((pack) => ({ id: `LOW_TICKETS_${pack.id}`, type: "LOW_TICKETS", severity: "HIGH", title: "Low tickets remaining", detail: `${pack.game.name} at display ${pack.slot?.slotNumber ?? "-"} has ${pack.currentTicketNumber ?? 0} ticket(s) remaining.`, createdAt: new Date().toISOString(), entityId: pack.id })),
      ...shifts.flatMap((shift) => {
        const audit = shift.inventoryAudit;
        if (audit?.status === "COMPLETED") return [];
        const incomplete = audit?.lines.filter((line) => line.beginningPhysicalTicket === null || line.endingPhysicalTicket === null).length ?? 0;
        return [{ id: `AUDIT_${shift.id}`, type: "INCOMPLETE_AUDIT", severity: "URGENT", title: "Shift audit incomplete", detail: `${incomplete || "The"} audit scan(s) remain incomplete for the shift opened by ${shift.openedBy.name}.`, createdAt: shift.openedAt.toISOString(), entityId: shift.id }];
      }),
      ...shipments.map((shipment) => ({ id: `SHIPMENT_${shipment.id}`, type: "STALE_RECEIVING", severity: "MEDIUM", title: "Receiving draft is overdue", detail: `Invoice ${shipment.invoiceNumber} has been in progress for more than 24 hours (${shipment.expectedPacks} expected pack(s)).`, createdAt: shipment.createdAt.toISOString(), entityId: shipment.id })),
    ];
    return NextResponse.json({ alerts });
  } catch (error) {
    console.error("[GET /api/alerts/operational]", error);
    return NextResponse.json({ error: "Unable to load operational alerts." }, { status: 500 });
  }
}
