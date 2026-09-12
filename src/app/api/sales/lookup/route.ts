import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiSession } from "@/lib/api-session";

export async function POST(req: NextRequest) {
  try {
    const session = await getApiSession();
    if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

    const { gameNumber, packNumber, ticketNumber } = await req.json();

    if (!gameNumber || !packNumber || ticketNumber === undefined) {
      return NextResponse.json(
        { error: "Missing ticket information." },
        { status: 400 }
      );
    }

    const pack = await prisma.pack.findFirst({
      where: {
        storeId: session.storeId,
        gameNumber,
        packNumber,
        status: "ACTIVE",
      },
      include: {
        game: true,
        slot: true,
      },
    });

    if (!pack) {
      return NextResponse.json(
        { error: "Active pack not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      pack,
      ticketNumber,
    });

  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Unable to lookup ticket." },
      { status: 500 }
    );
  }
}
