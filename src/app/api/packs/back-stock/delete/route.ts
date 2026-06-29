import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(req: NextRequest) {
  const { packId } = await req.json();

  await prisma.pack.delete({
    where: {
      id: packId,
    },
  });

  return NextResponse.json({
    success: true,
  });
}