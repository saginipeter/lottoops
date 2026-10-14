import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiSession } from "@/lib/api-session";

export async function GET(req: NextRequest) {
  const session = await getApiSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!prisma) {
    return NextResponse.json({ error: "Database not connected" }, { status: 503 });
  }

  try {
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
  } catch (error) {
    console.error("[GET /api/packs/back-stock]", error);
    return NextResponse.json({ error: "Unable to load back stock. Please retry." }, { status: 500 });
  }
}