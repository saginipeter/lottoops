// app/api/display-slots/auto-fill/route.ts

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getApiSession } from "@/lib/api-session";
import { canManageBackstock } from "@/lib/permissions";
import { activatePackToDisplay, ActivationAuditConflict } from "@/lib/activation-audit-snapshot";

export async function POST(req: NextRequest) {
  const session = await getApiSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!canManageBackstock(session)) {
    return NextResponse.json(
      { error: "You don't have permission to fill slots" },
      { status: 403 }
    );
  }

  if (!prisma) {
    return NextResponse.json(
      { error: "Database not connected" },
      { status: 503 }
    );
  }

  try {
    const { slotId } = await req.json();

    const [slot, nextPack] = await Promise.all([
      prisma.displaySlot.findFirst({ where: { id: slotId, storeId: session.storeId }, select: { id: true, packId: true, slotNumber: true } }),
      prisma.pack.findFirst({ where: { storeId: session.storeId, status: "BACK_STOCK" }, orderBy: { receivedAt: "asc" }, select: { id: true, firstTicket: true } }),
    ]);
    if (!slot) return NextResponse.json({ error: "Display slot not found or access denied." }, { status: 404 });
    if (slot.packId) return NextResponse.json({ error: "Slot already contains a pack." }, { status: 409 });
    if (!nextPack) return NextResponse.json({ error: "No packs available in Back Stock." }, { status: 404 });
    const pack = await prisma.$transaction((tx: Prisma.TransactionClient) => activatePackToDisplay(tx, {
      storeId: session.storeId, actorId: session.userId, packId: nextPack.id, slotId: slot.id,
      firstOrLastTicket: "FIRST", startingTicketNumber: nextPack.firstTicket ?? 1,
      detail: `Activated oldest back-stock pack to display ${slot.slotNumber}`,
    }), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return NextResponse.json({ success: true, pack });
  } catch (error) {
    if (error instanceof ActivationAuditConflict) return NextResponse.json({ error: error.message }, { status: 409 });
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2034") {
      return NextResponse.json({ error: "Inventory changed during activation. Refresh and try again." }, { status: 409 });
    }
    console.error(error);

    return NextResponse.json(
      {
        error: "Unable to fill display slot.",
      },
      {
        status: 500,
      }
    );
  }
}
