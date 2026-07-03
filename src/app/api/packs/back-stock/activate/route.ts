import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const { packId, slotId } = await req.json();

  await prisma.pack.update({
    where: {
      id: packId,
    },
    data: {
      status: "ACTIVE",
      slotId,
      activatedAt: new Date(),
    },
  });

  return NextResponse.json({
    success: true,
  });
}