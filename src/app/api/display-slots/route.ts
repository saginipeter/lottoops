import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiSession } from "@/lib/api-session";

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

  if (session.role === "VIEWER") {
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
      return NextResponse.json({ error: "Slot not found." }, { status: 404 });
    }

    const pack = await prisma.pack.findFirst({
      where: { id: packId, storeId: session.storeId },
    });

    if (!pack) {
      return NextResponse.json({ error: "Pack not found." }, { status: 404 });
    }

    if (pack.status !== "BACK_STOCK") {
      return NextResponse.json(
        { error: "Only back stock packs can be assigned." },
        { status: 409 }
      );
    }

    if (slot.packId) {
      return NextResponse.json(
        { error: "Slot already contains a pack." },
        { status: 409 }
      );
    }

    await prisma.$transaction([
      prisma.displaySlot.update({
        where: {
          id: slot.id,
        },
        data: {
          packId,
        },
      }),
      prisma.pack.update({
        where: {
          id: pack.id,
        },
        data: {
          status: "ACTIVE",
          activatedAt: new Date(),
          currentTicketNumber: pack.firstTicket ?? 0,
        },
      }),
      prisma.scanLogEntry.create({
        data: {
          storeId: session.storeId,
          action: "ACTIVATED",
          packId: pack.id,
          performedById: session.userId,
          detail: `Assigned pack to display slot ${slot.slotNumber}`,
        },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Unable to assign pack." },
      { status: 500 }
    );
  }
}

// Clear one slot or all slots for the current store
export async function DELETE(req: Request) {
  const session = await getApiSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (session.role === "VIEWER") {
    return NextResponse.json(
      { error: "You don't have permission to clear display slots" },
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
        { error: "slotId or clearAll is required." },
        { status: 400 }
      );
    }

    if (clearAll) {
      const storeSlots = await prisma.displaySlot.findMany({
        where: { storeId: session.storeId, packId: { not: null } },
        select: { id: true, slotNumber: true, packId: true },
      });

      const packIds = storeSlots
        .map((slot: { packId: string | null }) => slot.packId)
        .filter((id: string | null): id is string => Boolean(id));

      await prisma.$transaction([
        prisma.displaySlot.updateMany({
          where: { storeId: session.storeId },
          data: { packId: null },
        }),
        prisma.pack.updateMany({
          where: { id: { in: packIds }, status: "ACTIVE" },
          data: { status: "BACK_STOCK" },
        }),
        prisma.scanLogEntry.create({
          data: {
            storeId: session.storeId,
            action: "RETURNED",
            performedById: session.userId,
            detail: `Cleared all display slots (${storeSlots.length})`,
          },
        }),
      ]);

      return NextResponse.json({ success: true, cleared: storeSlots.length });
    }

    const slot = await prisma.displaySlot.findFirst({
      where: { id: slotId, storeId: session.storeId },
      select: { id: true, slotNumber: true, packId: true },
    });

    if (!slot) {
      return NextResponse.json({ error: "Slot not found." }, { status: 404 });
    }

    const txOps: any[] = [
      prisma.displaySlot.update({
        where: { id: slot.id },
        data: { packId: null },
      }),
      prisma.scanLogEntry.create({
        data: {
          storeId: session.storeId,
          action: "RETURNED",
          packId: slot.packId ?? undefined,
          performedById: session.userId,
          detail: `Cleared display slot ${slot.slotNumber}`,
        },
      }),
    ];

    if (slot.packId) {
      txOps.unshift(
        prisma.pack.updateMany({
          where: { id: slot.packId, status: "ACTIVE" },
          data: { status: "BACK_STOCK" },
        })
      );
    }

    await prisma.$transaction(txOps);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Unable to clear display slots." },
      { status: 500 }
    );
  }
}