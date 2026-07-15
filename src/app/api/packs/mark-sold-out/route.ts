import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiSession } from "@/lib/api-session";

export async function POST(req: NextRequest) {
  const session = await getApiSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!prisma) {
    return NextResponse.json({ error: "Database not connected" }, { status: 503 });
  }

  try {
    const { packId } = await req.json();

    if (!packId || typeof packId !== "string") {
      return NextResponse.json({ error: "packId is required." }, { status: 400 });
    }

    const pack = await prisma.pack.findFirst({
      where: { id: packId, storeId: session.storeId },
      select: { id: true, status: true, serialNumber: true },
    });

    if (!pack) {
      return NextResponse.json({ error: "Pack not found." }, { status: 404 });
    }

    if (pack.status !== "ACTIVE") {
      return NextResponse.json({ error: "Only ACTIVE packs can be marked sold out." }, { status: 409 });
    }

    await prisma.$transaction([
      prisma.pack.update({
        where: { id: pack.id },
        data: {
          status: "SOLD_OUT",
          currentTicketNumber: 0,
          completedAt: new Date(),
        },
      }),
      prisma.displaySlot.updateMany({
        where: { packId: pack.id, storeId: session.storeId },
        data: { packId: null },
      }),
      prisma.scanLogEntry.create({
        data: {
          storeId: session.storeId,
          action: "SOLD_OUT",
          packId: pack.id,
          performedById: session.userId,
          detail: `Pack ${pack.serialNumber} marked sold out from pack view.`,
        },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[POST /api/packs/mark-sold-out]", error);
    return NextResponse.json({ error: "Unable to mark pack sold out." }, { status: 500 });
  }
}

