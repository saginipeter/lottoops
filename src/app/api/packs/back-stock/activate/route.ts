import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const { packId } = await req.json();

  await prisma.pack.update({
    where: {
      id: packId,
    },

    data: {
      status: "ACTIVE",
      activatedAt: new Date(),
    },
  });

  return NextResponse.json({
    success: true,
  });
}