import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { packId, slotId } = await req.json();

    await prisma.$transaction([
      prisma.pack.update({
        where: {
          id: packId,
        },
        data: {
          status: "ACTIVE",
          activatedAt: new Date(),
        },
      }),

      prisma.displaySlot.update({
        where: {
          id: slotId,
        },
        data: {
          packId,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error: "Unable to activate pack.",
      },
      {
        status: 500,
      }
    );
  }
}