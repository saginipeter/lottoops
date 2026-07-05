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

    const { shipmentId } = await req.json();

    if (!shipmentId) {
      return NextResponse.json(
        { error: "Shipment ID is required." },
        { status: 400 }
      );
    }

    // Find shipment
    const shipment = await prisma.shipment.findUnique({
      where: {
        id: shipmentId,
      },
    });

    if (!shipment) {
      return NextResponse.json(
        { error: "Shipment not found." },
        { status: 404 }
      );
    }

    // Count scanned packs
    const scanned = await prisma.pack.count({
      where: {
        shipmentId,
      },
    });

    if (scanned !== shipment.expectedPacks) {
      return NextResponse.json(
        {
          error: `Expected ${shipment.expectedPacks} packs but scanned ${scanned}.`,
        },
        { status: 400 }
      );
    }

    const updatedShipment = await prisma.shipment.update({
      where: {
        id: shipmentId,
      },
      data: {
        scannedPacks: scanned,
        status: "RECEIVED",
        confirmedAt: new Date(),
      },
    });

    return NextResponse.json(updatedShipment);
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Failed to confirm shipment." },
      { status: 500 }
    );
  }
}