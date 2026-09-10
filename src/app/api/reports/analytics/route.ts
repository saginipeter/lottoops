import { NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-session";
import { canAccessReports } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

interface PackAnalyticsRow {
  status: string;
  receivedAt: Date;
  activatedAt: Date | null;
  completedAt: Date | null;
  retailValue: unknown;
  currentTicketNumber: number | null;
  ticketQuantity: number | null;
  activeRemovalReason: string | null;
  game: { name: string; gameNumber: string; price: unknown };
}

function daysBetween(start: Date, end: Date) {
  return Math.max((end.getTime() - start.getTime()) / 86400000, 0);
}

export async function GET() {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!canAccessReports(session)) return NextResponse.json({ error: "Reports access required." }, { status: 403 });
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  try {
    const packs = await prisma.pack.findMany({
      where: { storeId: session.storeId },
      select: {
        status: true,
        receivedAt: true,
        activatedAt: true,
        completedAt: true,
        retailValue: true,
        currentTicketNumber: true,
        ticketQuantity: true,
        activeRemovalReason: true,
        game: { select: { name: true, gameNumber: true, price: true } },
      },
      orderBy: { receivedAt: "desc" },
      take: 5000,
    }) as PackAnalyticsRow[];

    const now = new Date();
    const activated = packs.filter((pack) => pack.activatedAt);
    const completed = packs.filter((pack) => pack.activatedAt && pack.completedAt);
    const receiptToActivation = activated.map((pack) => daysBetween(pack.receivedAt, pack.activatedAt!));
    const activationToCompletion = completed.map((pack) => daysBetween(pack.activatedAt!, pack.completedAt!));
    const aging = packs
      .filter((pack) => pack.status === "BACK_STOCK" || pack.status === "ACTIVE")
      .map((pack) => ({
        status: pack.status,
        ageDays: daysBetween(pack.status === "ACTIVE" ? pack.activatedAt ?? pack.receivedAt : pack.receivedAt, now),
        value: Number(pack.retailValue ?? 0),
      }));

    const gameMap = new Map<string, { gameNumber: string; game: string; packs: number; tickets: number; value: number }>();
    for (const pack of packs) {
      const key = pack.game.gameNumber;
      const current = gameMap.get(key) ?? { gameNumber: key, game: pack.game.name, packs: 0, tickets: 0, value: 0 };
      current.packs += 1;
      current.tickets += Math.max(Number(pack.ticketQuantity ?? 0) - Number(pack.currentTicketNumber ?? 0), 0);
      current.value += Number(pack.retailValue ?? 0);
      gameMap.set(key, current);
    }

    return NextResponse.json({
      generatedAt: now.toISOString(),
      summary: {
        averageReceiptToActivationDays: receiptToActivation.length ? Number((receiptToActivation.reduce((sum, value) => sum + value, 0) / receiptToActivation.length).toFixed(1)) : 0,
        averageActivationToCompletionDays: activationToCompletion.length ? Number((activationToCompletion.reduce((sum, value) => sum + value, 0) / activationToCompletion.length).toFixed(1)) : 0,
        backstockExposure: aging.filter((row) => row.status === "BACK_STOCK").reduce((sum, row) => sum + row.value, 0),
        activeExposure: aging.filter((row) => row.status === "ACTIVE").reduce((sum, row) => sum + row.value, 0),
        backstockOver30Days: aging.filter((row) => row.status === "BACK_STOCK" && row.ageDays >= 30).length,
        activeOver30Days: aging.filter((row) => row.status === "ACTIVE" && row.ageDays >= 30).length,
        reassignedPacks: packs.filter((pack) => pack.activeRemovalReason === "REASSIGNED").length,
      },
      games: Array.from(gameMap.values()).sort((a, b) => b.tickets - a.tickets).slice(0, 25),
    });
  } catch (error) {
    console.error("[GET /api/reports/analytics]", error);
    return NextResponse.json({ error: "Unable to load lifecycle analytics." }, { status: 500 });
  }
}
