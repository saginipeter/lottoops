import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/get-session";
import { logInventoryActivity } from "@/lib/activity-log";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const {
      packId,
      activeRemovalReason,
      activeRemovalReasonText,
      reassignToSlotId,
    } = await req.json();

    if (!packId) {
      return NextResponse.json(
        { error: "Pack ID is required." },
        { status: 400 }
      );
    }

    if (!activeRemovalReason || !["STOLEN", "RETURNED", "REASSIGNED", "OTHER"].includes(activeRemovalReason)) {
      return NextResponse.json(
        { error: "Valid removal reason is required (STOLEN, RETURNED, REASSIGNED, OTHER)." },
        { status: 400 }
      );
    }

    if (activeRemovalReason === "OTHER" && !activeRemovalReasonText?.trim()) {
      return NextResponse.json(
        { error: "Reason description is required when selecting OTHER." },
        { status: 400 }
      );
    }

    if (activeRemovalReason === "REASSIGNED" && !reassignToSlotId) {
      return NextResponse.json(
        { error: "Target display is required when reassigning." },
        { status: 400 }
      );
    }

    // Verify pack exists and belongs to user's store
    const pack = await prisma.pack.findUnique({
      where: { id: packId },
      include: { slot: true },
    });

    if (!pack || pack.storeId !== session.storeId) {
      return NextResponse.json(
        { error: "Pack not found or access denied." },
        { status: 404 }
      );
    }

    if (pack.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Only ACTIVE packs can be removed." },
        { status: 400 }
      );
    }

    if (activeRemovalReason === "REASSIGNED") {
      // Verify target display exists and is available
      const targetSlot = await prisma.displaySlot.findUnique({
        where: { id: reassignToSlotId },
      });

      if (!targetSlot || targetSlot.storeId !== session.storeId) {
        return NextResponse.json(
          { error: "Target display not found or access denied." },
          { status: 404 }
        );
      }

      if (targetSlot.packId && targetSlot.packId !== packId) {
        return NextResponse.json(
          { error: "Target display is occupied." },
          { status: 400 }
        );
      }

      // Remove pack from current slot
      if (pack.slot) {
        await prisma.displaySlot.update({
          where: { id: pack.slot.id },
          data: { packId: null },
        });
      }

      // Assign pack to new slot
      await prisma.displaySlot.update({
        where: { id: reassignToSlotId },
        data: { packId },
      });
    } else {
      // Remove pack from its slot
      if (pack.slot) {
        await prisma.displaySlot.update({
          where: { id: pack.slot.id },
          data: { packId: null },
        });
      }
    }

    // Update pack with removal details
    let newStatus = "RETURNED";
    if (activeRemovalReason === "STOLEN") {
      newStatus = "RETURNED"; // Could add STOLEN status if needed
    } else if (activeRemovalReason === "REASSIGNED") {
      newStatus = "ACTIVE"; // Keep active when reassigning
    }

    const updatedPack = await prisma.pack.update({
      where: { id: packId },
      data: {
        status: newStatus,
        activeRemovalReason,
        activeRemovalReasonText: activeRemovalReasonText || null,
        activeRemovalReasonAt: new Date(),
        reassignedToSlotId: activeRemovalReason === "REASSIGNED" ? reassignToSlotId : null,
      },
    });

    await logInventoryActivity({
      storeId: session.storeId,
      action: activeRemovalReason === "REASSIGNED" ? "REASSIGN_DISPLAY" : "REMOVE_FROM_DISPLAY",
      entityType: "PACK",
      entityId: packId,
      detail:
        activeRemovalReason === "REASSIGNED"
          ? `Reassigned pack ${packId} to display ${reassignToSlotId}.`
          : `Removed pack ${packId} from display as inactive with reason ${activeRemovalReason}${activeRemovalReasonText ? ` (${activeRemovalReasonText})` : ""}.`,
      performedById: session.userId,
    });

    return NextResponse.json({
      success: true,
      pack: updatedPack,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Unable to process pack removal." },
      { status: 500 }
    );
  }
}
