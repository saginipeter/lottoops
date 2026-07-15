import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/get-session";

export async function GET(req: NextRequest) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const includeActive = req.nextUrl.searchParams.get("includeActive") === "true";
  const whereClause = includeActive
    ? {
        storeId: session.storeId,
        OR: [
          { status: "BACK_STOCK" as const },
          { status: "ACTIVE" as const, slot: null },
        ],
      }
    : {
        storeId: session.storeId,
        status: "BACK_STOCK" as const,
      };

  const packs = await prisma.pack.findMany({
    where: whereClause,

    include: {
      game: true,
      shipment: true,
    },

    orderBy: {
      receivedAt: "desc",
    },
  });

  return NextResponse.json(packs);
}