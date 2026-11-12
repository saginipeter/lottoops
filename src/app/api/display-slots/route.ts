import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getApiSession } from "@/lib/api-session";
import { canManageDisplay } from "@/lib/permissions";
import { ensureDisplaySlots } from "@/lib/services/display-slots";
import { activatePackToDisplay, ActivationAuditConflict, assignActivePackToDisplay } from "@/lib/activation-audit-snapshot";

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

    const [slot, pack] = await Promise.all([
      prisma.displaySlot.findFirst({ where: { id: slotId, storeId: session.storeId }, select: { id: true, slotNumber: true, packId: true } }),
      prisma.pack.findFirst({ where: { id: packId, storeId: session.storeId }, select: { id: true, status: true } }),
    ]);
    if (!slot) return NextResponse.json({ error: "Display not found." }, { status: 404 });
    if (!pack) return NextResponse.json({ error: "Pack not found." }, { status: 404 });
    if (slot.packId) return NextResponse.json({ error: "Display already contains a pack." }, { status: 409 });
    if (pack.status !== "BACK_STOCK" && pack.status !== "ACTIVE") {
      return NextResponse.json({ error: "Only back stock or unassigned active packs can be assigned." }, { status: 409 });
    }
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      if (pack.status === "BACK_STOCK") {
        await activatePackToDisplay(tx, {
          storeId: session.storeId, actorId: session.userId, packId: pack.id, slotId: slot.id,
          detail: `Activated and assigned pack to display ${slot.slotNumber}`,
        });
      } else {
        await assignActivePackToDisplay(tx, {
          storeId: session.storeId, actorId: session.userId, packId: pack.id, slotId: slot.id,
          detail: `Assigned active pack to display ${slot.slotNumber}`,
        });
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ActivationAuditConflict) return NextResponse.json({ error: error.message }, { status: 409 });
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2034") {
      return NextResponse.json({ error: "Inventory changed during display assignment. Refresh and try again." }, { status: 409 });
    }
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
