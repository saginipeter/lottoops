import { NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-session";
import { canManageBackstock, canReceiveShipments } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canReceiveShipments(session) && !canManageBackstock(session)) {
    return NextResponse.json({ error: "You do not have permission to view shipments." }, { status: 403 });
  }
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  try {
    const { id } = await params;
    const shipment = await prisma.shipment.findFirst({
      where: { id, storeId: session.storeId },
      include: {
        receivedBy: { select: { name: true } },
        packs: {
          where: { storeId: session.storeId },
          select: {
            id: true, serialNumber: true, packNumber: true, gameNumber: true,
            ticketQuantity: true, ticketPrice: true, cost: true, retailValue: true,
            game: { select: { name: true, gameNumber: true, price: true, ticketsPerPack: true } },
          },
          orderBy: { receivedAt: "asc" },
        },
      },
    });
    if (!shipment) return NextResponse.json({ error: "Shipment not found." }, { status: 404 });
    return NextResponse.json(shipment);
  } catch (error) {
    console.error("Shipment report retrieval failed:", error);
    return NextResponse.json({ error: "Unable to load shipment report." }, { status: 500 });
  }
}
