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

    const body = await req.json();

    const {
      invoiceNumber,
      invoicePhoto,
      expectedPacks,
    } = body;

    if (!invoiceNumber) {
      return NextResponse.json(
        { error: "Invoice number is required" },
        { status: 400 }
      );
    }

    const shipment = await prisma.shipment.create({
      data: {
        invoiceNumber,
        invoicePhoto,

        expectedPacks,

        scannedPacks: 0,

        storeId: session.storeId,

        receivedById: session.userId,
      },
    });

    return NextResponse.json(shipment);

  } catch (err) {
    console.error(err);

    return NextResponse.json(
      { error: "Failed to create shipment" },
      { status: 500 }
    );
  }
}