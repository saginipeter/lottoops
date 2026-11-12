import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getApiSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";
import { isManagerOrAbove } from "@/lib/permissions";

class OverrideError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

export async function POST(req: NextRequest) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!isManagerOrAbove(session)) return NextResponse.json({ error: "Manager or owner approval required." }, { status: 403 });
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const shipmentId = typeof body.shipmentId === "string" ? body.shipmentId.trim() : "";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!shipmentId) return NextResponse.json({ error: "Shipment ID is required." }, { status: 400 });
  if (reason.length < 10) return NextResponse.json({ error: "Enter a detailed override reason of at least 10 characters." }, { status: 400 });

  try {
    const snapshot = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const shipments = await tx.$queryRawUnsafe<Array<{ id: string; invoiceNumber: string; expectedPacks: number }>>(
        `SELECT id, "invoiceNumber", "expectedPacks" FROM shipments
         WHERE id = $1 AND "storeId" = $2 AND status = 'IN_PROGRESS' FOR UPDATE`,
        shipmentId, session.storeId,
      );
      const shipment = shipments[0];
      if (!shipment) throw new OverrideError("In-progress shipment not found.", 404);
      await tx.$queryRawUnsafe(
        `SELECT id FROM packs WHERE "shipmentId" = $1 AND "storeId" = $2 ORDER BY id FOR UPDATE`,
        shipmentId, session.storeId,
      );
      const recordedPackQuantity = await tx.pack.count({ where: { shipmentId, storeId: session.storeId } });
      const detail = `Shipment override approved for invoice ${shipment.invoiceNumber}: expected ${shipment.expectedPacks} packs, recorded ${recordedPackQuantity} packs. ${reason}`;
      await tx.$executeRawUnsafe(`
        INSERT INTO inventory_activity_logs
          (store_id, action, entity_type, entity_id, detail, performed_by_id, performed_by_name,
           expected_pack_quantity, recorded_pack_quantity, quantity_unit)
        VALUES ($1, 'SHIPMENT_OVERRIDE', 'SHIPMENT', $2, $3, $4, $5, $6, $7, 'PACKS')
      `, session.storeId, shipment.id, detail, session.userId, session.name,
      shipment.expectedPacks, recordedPackQuantity);
      return { shipmentId: shipment.id, expectedPackQuantity: shipment.expectedPacks, recordedPackQuantity };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return NextResponse.json({ success: true, ...snapshot, quantityUnit: "PACKS" });
  } catch (error) {
    if (error instanceof OverrideError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2034") {
      return NextResponse.json({ error: "Shipment contents changed during approval. Refresh and approve the current count again." }, { status: 409 });
    }
    console.error("[POST /api/shipments/override]", error);
    return NextResponse.json({ error: "Unable to record shipment override." }, { status: 500 });
  }
}
