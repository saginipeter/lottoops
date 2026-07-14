import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { gameNumber, packNumber, ticketNumber } = await req.json();

    if (!gameNumber || !packNumber || ticketNumber === undefined) {
      return NextResponse.json(
        { error: "Missing ticket information." },
        { status: 400 }
      );
    }

    const pack = await prisma.pack.findFirst({
      where: {
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