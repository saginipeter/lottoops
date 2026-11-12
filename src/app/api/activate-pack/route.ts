import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getApiSession } from "@/lib/api-session";
import { canManageBackstock } from "@/lib/permissions";
import { activatePackToDisplay, ActivationAuditConflict } from "@/lib/activation-audit-snapshot";

export async function POST(req: NextRequest) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!canManageBackstock(session)) return NextResponse.json({ error: "You don't have permission to activate back-stock packs." }, { status: 403 });
  if (!prisma) return NextResponse.json({ error: "Database not connected" }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const packId = typeof body.packId === "string" ? body.packId.trim() : "";
  const slotId = typeof body.slotId === "string" ? body.slotId.trim() : "";
  if (!packId || !slotId) return NextResponse.json({ error: "Pack ID and Display ID are required." }, { status: 400 });

  try {
    await prisma.$transaction((tx: Prisma.TransactionClient) => activatePackToDisplay(tx, {
      storeId: session.storeId, actorId: session.userId, packId, slotId,
      firstOrLastTicket: "FIRST",
    }), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ActivationAuditConflict) return NextResponse.json({ error: error.message }, { status: 409 });
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2034") {
      return NextResponse.json({ error: "Inventory changed during activation. Refresh and try again." }, { status: 409 });
    }
    console.error("[POST /api/activate-pack]", error);
    return NextResponse.json({ error: "Activation failed." }, { status: 500 });
  }
}
