import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/get-session";

export async function GET(req: NextRequest) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const packs = await prisma.pack.findMany({
    where: {
      storeId: session.storeId,
      status: "BACK_STOCK",
    },

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