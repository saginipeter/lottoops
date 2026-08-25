import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiSession } from "@/lib/api-session";
import { canManageDisplay } from "@/lib/permissions";
import { ensureDisplaySlots } from "@/lib/services/display-slots";

function resolveSellableTicket(pack: {
  currentTicketNumber: number | null;
  firstTicket: number | null;
  ticketQuantity: number | null;
}) {
  const candidates = [pack.currentTicketNumber, pack.firstTicket, pack.ticketQuantity]
    .map((value) => Number(value ?? 0))
    .filter((value) => Number.isFinite(value) && value > 0);

  return candidates.length > 0 ? candidates[0] : null;
}

// GET all display slots
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
    await ensureDisplaySlots(session.storeId);
    const slots = await prisma.displaySlot.findMany({
      where: {
        storeId: session.storeId,
      },
      include: {
        pack: {
          include: {
            game: true,
          },
        },
      },
      orderBy: {
        slotNumber: "asc",
      },
    });

    return NextResponse.json(slots);
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Unable to load display slots." },
      { status: 500 }
    );
  }
}

// Assign a pack to a display slot
export async function POST(req: Request) {
  const session = await getApiSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!canManageDisplay(session)) {
    return NextResponse.json(
      { error: "You don't have permission to assign packs" },
      { status: 403 }
    );
  }

  if (!prisma) {
    return NextResponse.json(
      { error: "Database not connected" },
      { status: 503 }
    );
  }

  try {
    const { slotId, packId } = await req.json();

    if (!slotId || !packId) {
      return NextResponse.json(
        { error: "slotId and packId are required." },
        { status: 400 }
      );
    }

    // Prevent assigning an already active pack
    const existingSlot = await prisma.displaySlot.findFirst({
      where: {
        storeId: session.storeId,
        packId,
      },
    });

    if (existingSlot) {
      return NextResponse.json(
        { error: "Pack is already assigned to another display slot." },
        { status: 400 }
      );
    }

    const slot = await prisma.displaySlot.findFirst({
      where: { id: slotId, storeId: session.storeId },
    });

    if (!slot) {
      return NextResponse.json({ error: "Display not found." }, { status: 404 });
    }

    const pack = await prisma.pack.findFirst({
      where: { id: packId, storeId: session.storeId },
    });

    if (!pack) {
      return NextResponse.json({ error: "Pack not found." }, { status: 404 });
    }

    if (pack.status !== "BACK_STOCK" && pack.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Only back stock or unassigned active packs can be assigned." },
        { status: 409 }
      );
    }

    if (slot.packId) {
      return NextResponse.json(
        { error: "Slot already contains a pack." },
        { status: 409 }
      );
    }

    const sellableTicket = resolveSellableTicket(pack);
    if (pack.status === "BACK_STOCK" && sellableTicket === null) {
      return NextResponse.json(
        {
          error:
            "Pack has invalid ticket data. Set first ticket or quantity before assigning to display.",
        },
        { status: 409 }
      );
    }

    const txOps: any[] = [
      prisma.displaySlot.update({
        where: {
          id: slot.id,
        },
        data: {
          packId,
        },
      }),
      prisma.scanLogEntry.create({
        data: {
          storeId: session.storeId,
          action: "ACTIVATED",
          packId: pack.id,
          performedById: session.userId,
          detail:
            pack.status === "BACK_STOCK"
              ? `Activated and assigned pack to display ${slot.slotNumber}`
              : `Assigned active pack to display ${slot.slotNumber}`,
        },
      }),
    ];

    if (pack.status === "BACK_STOCK") {
      txOps.unshift(
        prisma.pack.update({
          where: {
            id: pack.id,
          },
          data: {
            status: "ACTIVE",
            activatedAt: new Date(),
            currentTicketNumber: sellableTicket,
          },
        })
      );
    }

    await prisma.$transaction(txOps);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Unable to assign pack." },
      { status: 500 }
    );
  }
}

// Clear one display when it's already empty
export async function DELETE(req: Request) {
  const session = await getApiSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (session.role === "EMPLOYEE") {
    return NextResponse.json(
      { error: "You don't have permission to clear displays" },
      { status: 403 }
    );
  }

  if (!prisma) {
    return NextResponse.json(
      { error: "Database not connected" },
      { status: 503 }
    );
  }

  try {
    const body = await req.json();
    const slotId = body?.slotId as string | undefined;
    const clearAll = body?.clearAll === true;

    if (!slotId && !clearAll) {
      return NextResponse.json(
        { error: "slotId is required." },
        { status: 400 }
      );
    }

    if (clearAll) {
      return NextResponse.json(
        {
          error:
            "Bulk clearing displays is disabled. Remove packs one-by-one with a reason.",
        },
        { status: 400 }
      );
    }

    const slot = await prisma.displaySlot.findFirst({
      where: { id: slotId, storeId: session.storeId },
      select: { id: true, slotNumber: true, packId: true },
    });

    if (!slot) {
      return NextResponse.json({ error: "Display not found." }, { status: 404 });
    }

    if (slot.packId) {
      return NextResponse.json(
        {
          error:
            "This display has an active pack. Remove it from Active Stock with a required reason.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Unable to update display." },
      { status: 500 }
    );
  }
}