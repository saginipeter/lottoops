import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiSession } from "@/lib/api-session";

export async function POST(req: NextRequest) {
  const session = await getApiSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!prisma) {
    return NextResponse.json(
      { error: "Database not connected" },
      { status: 503 }
    );
  }

  const { serialNumber } = await req.json();
  if (!serialNumber || typeof serialNumber !== "string") {
    return NextResponse.json(
      { error: "serialNumber is required" },
      { status: 400 }
    );
  }

  try {
    const isDuplicate = await prisma.pack.findFirst({
      where: { storeId: session.storeId, serialNumber },
      select: { id: true },
    });

    if (isDuplicate) {
      return NextResponse.json({ status: "duplicate" });
    }

    // Texas Lottery pack serials lead with the state-assigned game number
    // (e.g. "2739-0334219" -> game 2739). Only match active games — you
    // can't receive new inventory of a deactivated game.
    const match = serialNumber.match(/^(\d{3,4})/);
    if (!match) {
      return NextResponse.json({ status: "unrecognized" });
    }

    const game = await prisma.game.findFirst({
      where: { storeId: session.storeId, gameNumber: match[1], active: true },
    });

    if (!game) {
      return NextResponse.json({ status: "unrecognized" });
    }

    return NextResponse.json({
      status: "ok",
      game: { ...game, price: Number(game.price) },
    });
  } catch (err) {
    console.error("[POST /api/packs/check-serial]", err);
    return NextResponse.json(
      { error: "Failed to check serial number" },
      { status: 500 }
    );
  }
}