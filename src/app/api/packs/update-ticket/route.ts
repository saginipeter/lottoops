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
    const { packId, currentTicketNumber } = await req.json();

    if (!packId || typeof packId !== "string") {
      return NextResponse.json({ error: "packId is required." }, { status: 400 });
    }

    if (!Number.isInteger(currentTicketNumber) || currentTicketNumber < 0) {
      return NextResponse.json(
        { error: "currentTicketNumber must be a non-negative integer." },
        { status: 400 }
      );
    }

    const pack = await prisma.pack.findFirst({
      where: { id: packId, storeId: session.storeId },
      select: { id: true, status: true, firstTicket: true },
    });

    if (!pack) {
      return NextResponse.json({ error: "Pack not found." }, { status: 404 });
    }

    if (pack.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Only ACTIVE packs can have current ticket updated." },
        { status: 409 }
      );
    }

    if (pack.firstTicket !== null && currentTicketNumber > pack.firstTicket) {
      return NextResponse.json(
        { error: `Current ticket cannot be greater than first ticket (${pack.firstTicket}).` },
        { status: 400 }
      );
    }

    await prisma.pack.update({
      where: { id: pack.id },
      data: { currentTicketNumber },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[POST /api/packs/update-ticket]", error);
    return NextResponse.json({ error: "Unable to update current ticket." }, { status: 500 });
  }
}

