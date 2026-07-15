import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiSession } from "@/lib/api-session";

export async function POST(req: NextRequest) {
  try {
    const session = await getApiSession();

    if (!session) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    if (session.role === "EMPLOYEE") {
      return NextResponse.json(
        { error: "You don't have permission to remove back stock packs." },
        { status: 403 }
      );
    }

    const {
      packId,
      removalReason,
      removalReasonText,
    } = await req.json();

    if (!packId) {
      return NextResponse.json(
        { error: "Pack ID is required." },
        { status: 400 }
      );
    }

    if (!removalReason || !["RETURNED", "LOST", "OTHER"].includes(removalReason)) {
      return NextResponse.json(
        { error: "Valid removal reason is required (RETURNED, LOST, OTHER)." },
        { status: 400 }
      );
    }

    if (removalReason === "OTHER" && !removalReasonText?.trim()) {
      return NextResponse.json(
        { error: "Reason description is required when selecting OTHER." },
        { status: 400 }
      );
    }

    // Verify pack exists and belongs to user's store
    const pack = await prisma.pack.findUnique({
      where: { id: packId },
    });

    if (!pack || pack.storeId !== session.storeId) {
      return NextResponse.json(
        { error: "Pack not found or access denied." },
        { status: 404 }
      );
    }

    if (pack.status !== "BACK_STOCK") {
      return NextResponse.json(
        { error: "Only packs in BACK_STOCK can be removed." },
        { status: 400 }
      );
    }

    // Update pack with removal details
    const updatedPack = await prisma.pack.update({
      where: { id: packId },
      data: {
        status: "RETURNED",
        removalReason,
        removalReasonText: removalReasonText || null,
        removalReasonAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      pack: updatedPack,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Unable to remove pack." },
      { status: 500 }
    );
  }
}
