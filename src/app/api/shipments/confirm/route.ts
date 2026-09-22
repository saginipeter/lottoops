import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/get-session";
import { canReceiveShipments } from "@/lib/permissions";
import { remainingTicketsFromStartingTicket } from "@/lib/core-validation";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (!canReceiveShipments(session)) {
      return NextResponse.json(
        { error: "You do not have permission to confirm shipments." },
        { status: 403 }
      );
    }

    const {
      shipmentId,
      destination,
      expectedRetailValue,
      overrideApproved,
      firstOrLastTicket,
      activationNumber,
      activationReceiptPhoto,
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

    if (shipment.storeId !== session.storeId || shipment.status !== "IN_PROGRESS") {
      return NextResponse.json(
        { error: "Shipment is unavailable or access is denied." },
        { status: 409 }
      );
    }

    let hasRecordedOverride = false;
    if (overrideApproved === true) {
      try {
        const overrideRows = (await prisma.$queryRawUnsafe(
          `
          SELECT id
          FROM inventory_activity_logs
          WHERE store_id = $1
            AND action = 'SHIPMENT_OVERRIDE'
            AND entity_type = 'SHIPMENT'
            AND entity_id = $2
          LIMIT 1
          `,
          session.storeId,
          shipmentId
        )) as { id: number | bigint }[];
        hasRecordedOverride = overrideRows.length > 0;
      } catch {
        hasRecordedOverride = false;
      }
    }

    if (overrideApproved === true && !hasRecordedOverride) {
      return NextResponse.json(
        { error: "Manager or Owner approval is required before confirming this discrepancy." },
        { status: 403 }
      );
    }

    const shipmentPacks = await prisma.pack.findMany({
      where: {
        shipmentId,
        storeId: session.storeId,
      },
      select: {
        id: true,
        firstTicket: true,
        ticketQuantity: true,
        ticketPrice: true,
      },
    });

    const scanned = shipmentPacks.length;

    if (scanned !== shipment.expectedPacks && !hasRecordedOverride) {
      return NextResponse.json(
        {
          error: `Expected ${shipment.expectedPacks} packs but scanned ${scanned}.`,
        },
        { status: 400 }
      );
    }

    const parsedExpectedInventoryCost = Number(expectedRetailValue);
    const scannedRetailValue = shipmentPacks.reduce(
      (
        sum: number,
        pack: { ticketPrice: unknown; ticketQuantity: number | null }
      ) => sum + Number(pack.ticketPrice ?? 0) * Number(pack.ticketQuantity ?? 0),
      0
    );

    const expectedInventoryCost = Math.round(scannedRetailValue * 0.95 * 100) / 100;

    if (!Number.isFinite(parsedExpectedInventoryCost) || parsedExpectedInventoryCost <= 0) {
      return NextResponse.json(
        { error: "Expected inventory cost could not be calculated." },
        { status: 400 }
      );
    }

    if (
      Math.round(parsedExpectedInventoryCost * 100) !==
      Math.round(expectedInventoryCost * 100) &&
      !hasRecordedOverride
    ) {
      return NextResponse.json(
        {
          error: `Expected inventory cost ($${parsedExpectedInventoryCost.toFixed(2)}) does not match the calculated 95% cost ($${expectedInventoryCost.toFixed(2)}).`,
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

      await prisma.$transaction([
        ...shipmentPacks.map(
          (
            pack: { id: string; firstTicket: number | null; ticketQuantity: number | null },
            index: number
          ) => {
          const targetDisplay = availableDisplays[index];
          return prisma.pack.update({
            where: { id: pack.id },
            data: {
              status: "ACTIVE",
              activatedAt: new Date(),
              currentTicketNumber: firstOrLastTicket === "LAST"
                ? Number(pack.ticketQuantity ?? 0)
                : remainingTicketsFromStartingTicket(pack.firstTicket ?? 1, pack.ticketQuantity ?? 0),
              firstOrLastTicket: firstOrLastTicket === "LAST" ? "LAST" : "FIRST",
              activationNumber: activationNumber || undefined,
              activationReceipt: activationReceiptPhoto || undefined,
              slot: {
                connect: { id: targetDisplay.id },
              },
            },
          });
          }
        ),
        prisma.shipment.update({
          where: { id: shipmentId },
          data: {
            scannedPacks: scanned,
            status: "RECEIVED",
            confirmedAt: new Date(),
          },
        }),
      ]);
      return NextResponse.json({
        ...shipment,
        scannedPacks: scanned,
        status: "RECEIVED",
      });
    }

    const updatedShipment = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.pack.updateMany({
        where: { shipmentId, storeId: shipment.storeId, status: "RECEIVING" },
        data: { status: "BACK_STOCK" },
      });

      return tx.shipment.update({
        where: { id: shipmentId },
        data: {
          scannedPacks: scanned,
          status: "RECEIVED",
          confirmedAt: new Date(),
        },
      });
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
