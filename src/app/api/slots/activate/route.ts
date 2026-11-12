import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getApiSession } from "@/lib/api-session";
import { canManageBackstock } from "@/lib/permissions";
import { activatePackToDisplay, ActivationAuditConflict } from "@/lib/activation-audit-snapshot";

interface ActivateRequestBody {
  slotNumber?: unknown;
  packId?: unknown;
  startingTicketNumber?: unknown;
}

export async function POST(req: NextRequest) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!canManageBackstock(session)) return NextResponse.json({ error: "You don't have permission to activate back-stock packs." }, { status: 403 });
  if (!prisma) return NextResponse.json({ error: "Database not connected" }, { status: 503 });

  const body = await req.json().catch(() => null) as ActivateRequestBody | null;
  const slotNumber = typeof body?.slotNumber === "string" ? body.slotNumber.trim() : "";
  const packId = typeof body?.packId === "string" ? body.packId.trim() : "";
  const startingTicketNumber = body?.startingTicketNumber;
  if (!slotNumber || !packId || !Number.isInteger(startingTicketNumber)) {
    return NextResponse.json({ error: "slotNumber, packId, and a whole startingTicketNumber are required." }, { status: 400 });
  }

  try {
    const slot = await prisma.displaySlot.findFirst({ where: { storeId: session.storeId, slotNumber }, select: { id: true } });
    if (!slot) return NextResponse.json({ error: "Display not found." }, { status: 404 });
    await prisma.$transaction((tx: Prisma.TransactionClient) => activatePackToDisplay(tx, {
      storeId: session.storeId, actorId: session.userId, packId, slotId: slot.id,
      startingTicketNumber: Number(startingTicketNumber), firstOrLastTicket: "FIRST",
      detail: `Activated to display ${slotNumber} starting at ticket ${startingTicketNumber}`,
    }), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ActivationAuditConflict) return NextResponse.json({ error: error.message }, { status: 409 });
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2034") {
      return NextResponse.json({ error: "Inventory changed during activation. Refresh and try again." }, { status: 409 });
    }
    console.error("[POST /api/slots/activate]", error);
    return NextResponse.json({ error: "Failed to activate pack. Please try again." }, { status: 500 });
  }
}
