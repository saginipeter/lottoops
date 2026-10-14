import { NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-session";
import { canReceiveShipments, canManageBackstock } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { readShipmentDetail } from "@/lib/shipment-detail";

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canReceiveShipments(session) && !canManageBackstock(session)) {
    return NextResponse.json({ error: "You do not have permission to view shipments." }, { status: 403 });
  }
  if (!session.storeId) return NextResponse.json({ error: "No store selected." }, { status: 403 });
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  try {
    const { id } = await context.params;
    const shipment = await readShipmentDetail(prisma, id, session.storeId);
    if (!shipment) return NextResponse.json({ error: "Shipment not found." }, { status: 404 });
    return NextResponse.json(shipment, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Unable to load shipment." }, { status: 500 });
  }
}
