import { NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";

const PACK_STATUSES = ["BACK_STOCK", "ACTIVE", "RETURNED", "SOLD_OUT", "COMPLETED"] as const;

export async function GET(req: NextRequest) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const statusFilter = PACK_STATUSES.includes(status as (typeof PACK_STATUSES)[number])
    ? status
    : null;
  const q = searchParams.get("q")?.trim();

  const packs = await prisma.pack.findMany({
    where: {
      storeId: session.storeId,
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(q
        ? {
            OR: [
              { serialNumber: { contains: q, mode: "insensitive" } },
              { gameNumber: { contains: q, mode: "insensitive" } },
              { packNumber: { contains: q, mode: "insensitive" } },
              { game: { name: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    include: {
      game: { select: { name: true, gameNumber: true, price: true } },
      slot: { select: { slotNumber: true } },
    },
    orderBy: { receivedAt: "desc" },
    take: 1000,
  });

  const counts: Record<string, number> = packs.reduce((acc: Record<string, number>, p: { status: string }) => {
    acc[p.status] = (acc[p.status] ?? 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({ packs, counts });
}
