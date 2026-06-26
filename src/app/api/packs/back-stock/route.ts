import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiSession } from "@/lib/api-session";

export async function GET() {
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

  try {
    const packs = await prisma.pack.findMany({
      where: { storeId: session.storeId, status: "BACK_STOCK" },
      include: { game: true },
      orderBy: { receivedAt: "asc" },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const serialized = packs.map((p: any) => ({
      id: p.id,
      serialNumber: p.serialNumber,
      gameId: p.gameId,
      game: { ...p.game, price: Number(p.game.price) },
    }));

    return NextResponse.json({ packs: serialized });
  } catch (err) {
    console.error("[GET /api/packs/back-stock]", err);
    return NextResponse.json(
      { error: "Failed to load back stock" },
      { status: 500 }
    );
  }
}