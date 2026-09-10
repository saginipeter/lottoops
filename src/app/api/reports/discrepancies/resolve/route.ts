import { NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-session";
import { isManagerOrAbove } from "@/lib/permissions";
import { resolveDiscrepancy } from "@/lib/discrepancy-resolution";
import { prisma } from "@/lib/prisma";
import { logInventoryActivity } from "@/lib/activity-log";

export async function POST(request: NextRequest) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!isManagerOrAbove(session)) return NextResponse.json({ error: "Manager access required." }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const type = typeof body.type === "string" ? body.type.trim() : "";
  const id = typeof body.id === "string" ? body.id.trim() : "";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!type || !id || reason.length < 6) return NextResponse.json({ error: "Discrepancy type, ID, and a reason of at least 6 characters are required." }, { status: 400 });
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  try {
    if (type === "SEQUENCE_LOCK") {
      const pack = await prisma.pack.findFirst({
        where: { id, storeId: session.storeId, sequenceLocked: true },
        select: { id: true, sequenceLockExpectedTicket: true, sequenceLockScannedTicket: true },
      });
      if (!pack) return NextResponse.json({ error: "Active sequence lock not found for this store." }, { status: 404 });
      await prisma.pack.update({
        where: { id: pack.id },
        data: {
          sequenceLocked: false,
          sequenceLockExpectedTicket: null,
          sequenceLockScannedTicket: null,
          sequenceLockBarcode: null,
          sequenceLockedAt: null,
          sequenceLockedById: null,
        },
      });
      await logInventoryActivity({
        storeId: session.storeId,
        action: "SEQUENCE_LOCK_RESOLVED",
        entityType: "PACK",
        entityId: pack.id,
        detail: `Manager resolved sequence lock. Expected ${pack.sequenceLockExpectedTicket}, scanned ${pack.sequenceLockScannedTicket}. Reason: ${reason}`,
        performedById: session.userId,
        performedByName: session.name,
      });
    } else if (type !== "INVENTORY_AUDIT") {
      return NextResponse.json({ error: "Unsupported discrepancy type." }, { status: 400 });
    } else {
      const auditLine = await prisma.inventoryAuditLine.findFirst({
        where: { id, audit: { storeId: session.storeId } },
        select: { id: true },
      });
      if (!auditLine) return NextResponse.json({ error: "Inventory discrepancy not found for this store." }, { status: 404 });
    }
    await resolveDiscrepancy({ storeId: session.storeId, type, id, reason, userId: session.userId, userName: session.name });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[POST /api/reports/discrepancies/resolve]", error);
    return NextResponse.json({ error: "Unable to resolve discrepancy." }, { status: 500 });
  }
}
