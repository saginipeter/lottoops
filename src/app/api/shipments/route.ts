import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/get-session";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    console.log("Session:", session);

    const body = await req.json();

    console.log("Shipment request body:", body);

    const {
      invoiceNumber,
      invoicePhoto,
      shipmentConfirmationNumber,
      confirmationReceiptPhoto,
      expectedPacks,
      receivedBy,
      shipmentDate,
    } = body;

    // Validation
    if (!invoiceNumber?.trim()) {
      return NextResponse.json(
        { error: "Invoice number is required." },
        { status: 400 }
      );
    }

    if (!invoicePhoto?.trim()) {
      return NextResponse.json(
        { error: "Invoice photo is required." },
        { status: 400 }
      );
    }

    if (!shipmentConfirmationNumber?.trim()) {
      return NextResponse.json(
        { error: "Shipment confirmation number is required." },
        { status: 400 }
      );
    }

    if (!confirmationReceiptPhoto?.trim()) {
      return NextResponse.json(
        { error: "Confirmation receipt photo is required." },
        { status: 400 }
      );
    }

    if (!expectedPacks || Number(expectedPacks) <= 0) {
      return NextResponse.json(
        { error: "Expected packs must be greater than zero." },
        { status: 400 }
      );
    }

    if (!session.storeId) {
      return NextResponse.json(
        { error: "No store is associated with this user." },
        { status: 400 }
      );
    }

    if (!session.userId) {
      return NextResponse.json(
        { error: "Invalid user session." },
        { status: 400 }
      );
    }

  

    const shipment = await prisma.shipment.create({
      data: {
        invoiceNumber,
        invoicePhoto,
        shipmentConfirmationNumber,
        confirmationReceiptPhoto,
        expectedPacks: Number(expectedPacks),

        shipmentDate: shipmentDate
          ? new Date(shipmentDate)
          : undefined,

        scannedPacks: 0,

        storeId: session.storeId,
        receivedById: session.userId,
      },
    });

    console.log("Shipment created:", shipment);

    return NextResponse.json({
      success: true,
      ...shipment,
    });
  } catch (error: any) {
    console.error("Shipment creation failed:");
    console.error(error);

    return NextResponse.json(
      {
        error: error.message || "Failed to create shipment",
      },
      { status: 500 }
    );
  }
}