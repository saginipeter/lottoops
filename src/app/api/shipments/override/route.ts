import { NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";
import { isManagerOrAbove } from "@/lib/permissions";
import { logInventoryActivity } from "@/lib/activity-log";

export async function POST(req: NextRequest) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!isManagerOrAbove(session)) return NextResponse.json({ error: "Manager or owner approval required." }, { status: 403 });
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const shipmentId = typeof body.shipmentId === "string" ? body.shipmentId.trim() : "";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "Shipment discrepancy approved by management.";
  if (!shipmentId) return NextResponse.json({ error: "Shipment ID is required." }, { status: 400 });

  const shipment = await prisma.shipment.findFirst({
    where: { id: shipmentId, storeId: session.storeId, status: "IN_PROGRESS" },
    select: { id: true, invoiceNumber: true, expectedPacks: true },
  });
  if (!shipment) return NextResponse.json({ error: "In-progress shipment not found." }, { status: 404 });

  const scannedPacks = await prisma.pack.count({ where: { shipmentId, storeId: session.storeId } });
  await logInventoryActivity({
    storeId: session.storeId,
    action: "SHIPMENT_OVERRIDE",
    entityType: "SHIPMENT",
    entityId: shipment.id,
    detail: `Shipment override approved for invoice ${shipment.invoiceNumber}: expected ${shipment.expectedPacks}, scanned ${scannedPacks}. ${reason}`,
    performedById: session.userId,
    performedByName: session.name,
  });

  return NextResponse.json({ success: true, shipmentId, scannedPacks });
}