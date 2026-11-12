import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/get-session";
import { canManageBackstock } from "@/lib/permissions";
import { ActivationAuditConflict, activatePackToDisplay } from "@/lib/activation-audit-snapshot";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageBackstock(session)) return NextResponse.json({ error: "You do not have permission to activate back-stock packs." }, { status: 403 });
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const packId = typeof body.packId === "string" ? body.packId.trim() : "";
  const slotId = typeof body.slotId === "string" ? body.slotId.trim() : "";
  if (!packId) return NextResponse.json({ error: "Pack ID is required." }, { status: 400 });
  if (!slotId) return NextResponse.json({ error: "Display ID is required." }, { status: 400 });

  try {
    const pack = await prisma.$transaction((tx: Prisma.TransactionClient) => activatePackToDisplay(tx, {
      storeId: session.storeId,
      actorId: session.userId,
      packId,
      slotId,
      firstOrLastTicket: body.firstOrLastTicket,
      activationNumber: typeof body.activationNumber === "string" ? body.activationNumber : null,
      activationReceiptPhoto: typeof body.activationReceiptPhoto === "string" ? body.activationReceiptPhoto : null,
      lotNumber: typeof body.lotNumber === "string" ? body.lotNumber : null,
    }), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return NextResponse.json({ success: true, pack });
  } catch (error) {
    if (error instanceof ActivationAuditConflict) return NextResponse.json({ error: error.message }, { status: 409 });
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2034") {
      return NextResponse.json({ error: "Inventory changed during activation. Refresh and try again." }, { status: 409 });
    }
    console.error("[POST /api/packs/back-stock/activate]", error);
    return NextResponse.json({ error: "Unable to activate pack." }, { status: 500 });
  }
}
