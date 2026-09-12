import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiSession } from "@/lib/api-session";

export async function GET() {
  const session = await getApiSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!prisma) {
    return NextResponse.json(
      { error: "Database not connected" },
      { status: 503 }
    );
  }

  try {
    const slots = await prisma.displaySlot.findMany({
      where: { storeId: session.storeId },
      orderBy: { slotNumber: "asc" },
      include: {
        pack: {
          include: { game: true },
        },
      },
    });


    const serialized = slots.map((s: any) => ({
      slotNumber: s.slotNumber,
      pack: s.pack
        ? {
            id: s.pack.id,
            serialNumber: s.pack.serialNumber,
            status: s.pack.status,
            currentTicketNumber: s.pack.currentTicketNumber,
            gameId: s.pack.gameId,
            game: {
              ...s.pack.game,
              price: Number(s.pack.game.price),
            },
          }
        : null,
    }));

    return NextResponse.json({ slots: serialized });
  } catch (err) {
    console.error("[GET /api/slots]", err);
    return NextResponse.json(
      { error: "Failed to load display slots" },
      { status: 500 }
    );
  }
}