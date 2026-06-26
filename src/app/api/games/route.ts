import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiSession } from "@/lib/api-session";

export async function GET(req: NextRequest) {
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

  const includeInactive = req.nextUrl.searchParams.get("includeInactive") === "true";

  try {
    const games = await prisma.game.findMany({
      where: {
        storeId: session.storeId,
        ...(includeInactive ? {} : { active: true }),
      },
      orderBy: { gameNumber: "asc" },
    });

    // Decimal fields serialize as strings over JSON by default — convert
    // to plain numbers so the client doesn't need to know about Prisma's
    // Decimal type at all.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const serialized = games.map((g: any) => ({
      ...g,
      price: Number(g.price),
    }));

    return NextResponse.json({ games: serialized });
  } catch (err) {
    console.error("[GET /api/games]", err);
    return NextResponse.json(
      { error: "Failed to load games" },
      { status: 500 }
    );
  }
}