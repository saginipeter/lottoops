import { NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";
import { canAccessReports } from "@/lib/permissions";

export async function GET() {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!canAccessReports(session)) return NextResponse.json({ error: "Reports access required." }, { status: 403 });
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  try {
    const packs = await prisma.pack.findMany({
      where: { storeId: session.storeId, status: { in: ["BACK_STOCK", "ACTIVE"] } },
      select: { id: true, serialNumber: true, status: true, receivedAt: true, activatedAt: true, game: { select: { name: true, gameNumber: true } }, slot: { select: { slotNumber: true } } },
      orderBy: { receivedAt: "asc" },
      take: 250,
    });
    const now = Date.now();
    return NextResponse.json({ packs: packs.map((pack: { id: string; serialNumber: string; status: string; receivedAt: Date; activatedAt: Date | null; game: { name: string; gameNumber: string }; slot: { slotNumber: string } | null }) => ({
      id: pack.id,
      serialNumber: pack.serialNumber,
      game: pack.game.name,
      gameNumber: pack.game.gameNumber,
      status: pack.status,
      display: pack.slot?.slotNumber ?? null,
      receivedAt: pack.receivedAt,
      activatedAt: pack.activatedAt,
      ageDays: Math.max(Math.floor((now - new Date(pack.status === "ACTIVE" ? pack.activatedAt ?? pack.receivedAt : pack.receivedAt).getTime()) / 86400000), 0),
    })) });
  } catch (error) {
    console.error("[GET /api/reports/aging]", error);
    return NextResponse.json({ error: "Unable to load inventory aging." }, { status: 500 });
  }
}
