import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiSession } from "@/lib/api-session";

export async function POST(request: NextRequest) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!prisma) return NextResponse.json({ error: "Database not connected" }, { status: 503 });

  const { shiftId } = await request.json().catch(() => ({}));
  if (!shiftId || typeof shiftId !== "string") {
    return NextResponse.json({ error: "shiftId is required." }, { status: 400 });
  }

  try {
    const shift = await prisma.shift.findFirst({
      where: { id: shiftId, storeId: session.storeId, status: "OPEN" },
      include: { lines: { include: { pack: { select: { currentTicketNumber: true, firstTicket: true } } } } },
    });
    if (!shift) return NextResponse.json({ error: "Open shift not found." }, { status: 404 });

    const audit = await prisma.inventoryAudit.create({
      data: {
        storeId: session.storeId,
        shiftId: shift.id,
        begunById: session.userId,
        lines: {
          create: shift.lines.map((line: {
            packId: string;
            slotNumber: string;
            beginningTicket: number;
            pack: { currentTicketNumber: number | null; firstTicket: number | null };
          }) => ({
            packId: line.packId,
            slotNumber: line.slotNumber,
            expectedTicket: Number(line.pack.currentTicketNumber ?? line.pack.firstTicket ?? line.beginningTicket),
          })),
        },
      },
      include: { lines: true },
    });
    return NextResponse.json(audit, { status: 201 });
  } catch (error) {
    console.error("[POST /api/inventory-audits/begin]", error);
    return NextResponse.json({ error: "Unable to begin inventory audit." }, { status: 409 });
  }
}
