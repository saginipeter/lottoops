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

    const {
      shipmentId,
      destination,
      notes,
      expectedTickets,
      expectedRetailValue,
    } = await req.json();

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

    const shipmentPacks = await prisma.pack.findMany({
      where: {
        shipmentId,
      },
      select: {
        id: true,
        firstTicket: true,
        ticketQuantity: true,
        ticketPrice: true,
      },
    });

    const scanned = shipmentPacks.length;

    if (scanned !== shipment.expectedPacks) {
      return NextResponse.json(
        {
          error: `Expected ${shipment.expectedPacks} packs but scanned ${scanned}.`,
        },
        { status: 400 }
      );
    }

    const parsedExpectedTickets = Number(expectedTickets);
    const parsedExpectedRetailValue = Number(expectedRetailValue);
    const scannedTickets = shipmentPacks.reduce(
      (sum, pack) => sum + Number(pack.ticketQuantity ?? 0),
      0
    );
    const scannedRetailValue = shipmentPacks.reduce(
      (sum, pack) =>
        sum + Number(pack.ticketPrice ?? 0) * Number(pack.ticketQuantity ?? 0),
      0
    );

    if (!Number.isInteger(parsedExpectedTickets) || parsedExpectedTickets <= 0) {
      return NextResponse.json(
        { error: "Expected invoice tickets are required for confirmation." },
        { status: 400 }
      );
    }

    if (!Number.isFinite(parsedExpectedRetailValue) || parsedExpectedRetailValue <= 0) {
      return NextResponse.json(
        { error: "Expected invoice total value is required for confirmation." },
        { status: 400 }
      );
    }

    if (parsedExpectedTickets !== scannedTickets) {
      return NextResponse.json(
        {
          error: `Invoice tickets (${parsedExpectedTickets}) do not match scanned tickets (${scannedTickets}).`,
        },
        { status: 400 }
      );
    }

    if (
      Math.round(parsedExpectedRetailValue * 100) !==
      Math.round(scannedRetailValue * 100)
    ) {
      return NextResponse.json(
        {
          error: `Invoice value ($${parsedExpectedRetailValue.toFixed(2)}) does not match scanned value ($${scannedRetailValue.toFixed(2)}).`,
        },
        { status: 400 }
      );
    }

    // If destination is "active", activate only with display assignment.
    if (destination === "active") {
      const availableDisplays = await prisma.displaySlot.findMany({
        where: {
          storeId: shipment.storeId,
          packId: null,
        },
        orderBy: { slotNumber: "asc" },
      });

      if (availableDisplays.length < shipmentPacks.length) {
        return NextResponse.json(
          {
            error: `Cannot activate shipment: ${shipmentPacks.length} packs need display assignment, but only ${availableDisplays.length} displays are free.`,
          },
          { status: 400 }
        );
      }

      await prisma.$transaction(
        shipmentPacks.map((pack, index) => {
          const targetDisplay = availableDisplays[index];
          return prisma.pack.update({
            where: { id: pack.id },
            data: {
              status: "ACTIVE",
              activatedAt: new Date(),
              currentTicketNumber: pack.firstTicket ?? pack.ticketQuantity ?? 0,
              slot: {
                connect: { id: targetDisplay.id },
              },
            },
          });
        })
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