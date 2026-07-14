import { NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const session = await getApiSession();

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { packId } = await req.json();

    if (!packId) {
      return NextResponse.json(
        { error: "Pack ID is required" },
        { status: 400 }
      );
    }

    // Fetch the pack and verify it belongs to user's store
    const pack = await prisma.pack.findUnique({
      where: { id: packId },
      include: { shipment: true },
    });

    if (!pack) {
      return NextResponse.json(
        { error: "Pack not found" },
        { status: 404 }
      );
    }

    // Verify store access
    if (pack.shipment.storeId !== session.storeId) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    // Verify pack is in ACTIVE status
    if (pack.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Pack must be in ACTIVE status to mark completed" },
        { status: 400 }
      );
    }

    // Update pack to COMPLETED
    const updated = await prisma.pack.update({
      where: { id: packId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
      },
      include: { game: true },
    });

    return NextResponse.json({
      success: true,
      pack: updated,
    });
  } catch (err) {
    console.error("Error marking pack completed:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
