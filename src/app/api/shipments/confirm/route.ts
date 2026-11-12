import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/get-session";
import { canReceiveShipments } from "@/lib/permissions";
import { activatePacksToDisplays, ActivationAuditConflict } from "@/lib/activation-audit-snapshot";

class ShipmentActivationError extends Error {
  constructor(message: string, readonly status = 409) { super(message); }
}

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
      try {
        const updatedShipment = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          const lockedShipments = await tx.$queryRawUnsafe<Array<{ id: string; expectedPacks: number }>>(
            `SELECT id, "expectedPacks" AS "expectedPacks" FROM shipments
             WHERE id = $1 AND "storeId" = $2 AND status = 'IN_PROGRESS' FOR UPDATE`,
            shipmentId, session.storeId,
          );
          const lockedShipment = lockedShipments[0];
          if (!lockedShipment) throw new ShipmentActivationError("Shipment was already confirmed or is no longer available.");

          const currentPacks = await tx.pack.findMany({
            where: { shipmentId, storeId: session.storeId, status: "RECEIVING" },
            select: { id: true, firstTicket: true, ticketQuantity: true, ticketPrice: true },
            orderBy: { id: "asc" },
          });
          const currentCount = currentPacks.length;
          const overrideRows = await tx.$queryRawUnsafe<Array<{ id: string }>>(
            `SELECT id::text AS id FROM inventory_activity_logs
             WHERE store_id = $1 AND action = 'SHIPMENT_OVERRIDE' AND entity_type = 'SHIPMENT' AND entity_id = $2
             ORDER BY created_at DESC LIMIT 1`,
            session.storeId, shipmentId,
          );
          const approved = overrideRows.length > 0;
          if (currentCount !== lockedShipment.expectedPacks && !approved) {
            throw new ShipmentActivationError(`Expected ${lockedShipment.expectedPacks} packs but scanned ${currentCount}.`, 400);
          }
          const currentRetailValue = currentPacks.reduce((sum, pack) => sum + Number(pack.ticketPrice ?? 0) * Number(pack.ticketQuantity ?? 0), 0);
          const currentCost = Math.round(currentRetailValue * 0.95 * 100) / 100;
          if (Math.round(parsedExpectedInventoryCost * 100) !== Math.round(currentCost * 100) && !approved) {
            throw new ShipmentActivationError(`Expected inventory cost ($${parsedExpectedInventoryCost.toFixed(2)}) does not match the calculated 95% cost ($${currentCost.toFixed(2)}).`, 400);
          }

          const availableDisplays = await tx.displaySlot.findMany({
            where: { storeId: session.storeId, packId: null },
            orderBy: { slotNumber: "asc" },
            take: currentCount,
          });
          if (availableDisplays.length < currentCount) {
            throw new ShipmentActivationError(`Cannot activate shipment: ${currentCount} packs need display assignment, but only ${availableDisplays.length} displays are free.`, 400);
          }

          await activatePacksToDisplays(tx, currentPacks.map((pack, index) => ({
            storeId: session.storeId,
            actorId: session.userId,
            packId: pack.id,
            slotId: availableDisplays[index].id,
            firstOrLastTicket: firstOrLastTicket === "LAST" ? "LAST" : "FIRST",
            allowedCurrentStatus: "RECEIVING",
            activationNumber: typeof activationNumber === "string" ? activationNumber : null,
            activationReceipt: typeof activationReceiptPhoto === "string" ? activationReceiptPhoto : null,
            activationReceiptPhoto: typeof activationReceiptPhoto === "string" ? activationReceiptPhoto : null,
            detail: `Activated during shipment ${shipment.invoiceNumber} to display ${availableDisplays[index].slotNumber}`,
          })));
          return tx.shipment.update({
            where: { id: shipmentId },
            data: { scannedPacks: currentCount, status: "RECEIVED", confirmedAt: new Date() },
          });
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
        return NextResponse.json(updatedShipment);
      } catch (error) {
        if (error instanceof ShipmentActivationError || error instanceof ActivationAuditConflict) {
          return NextResponse.json({ error: error.message }, { status: error instanceof ShipmentActivationError ? error.status : 409 });
        }
        if (typeof error === "object" && error !== null && "code" in error && error.code === "P2034") {
          return NextResponse.json({ error: "Shipment or inventory changed during confirmation. Refresh before trying again." }, { status: 409 });
        }
        throw error;
      }
    }

    const updatedShipment = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const lockedShipments = await tx.$queryRawUnsafe<Array<{ id: string; expectedPacks: number }>>(
        `SELECT id, "expectedPacks" AS "expectedPacks" FROM shipments
         WHERE id = $1 AND "storeId" = $2 AND status = 'IN_PROGRESS' FOR UPDATE`,
        shipmentId, session.storeId,
      );
      const lockedShipment = lockedShipments[0];
      if (!lockedShipment) throw new ShipmentActivationError("Shipment was already confirmed or is no longer available.");

      const currentPacks = await tx.pack.findMany({
        where: { shipmentId, storeId: session.storeId, status: "RECEIVING" },
        select: { id: true, ticketPrice: true, ticketQuantity: true },
        orderBy: { id: "asc" },
      });
      const currentCount = currentPacks.length;
      const overrideRows = await tx.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT id::text AS id FROM inventory_activity_logs
         WHERE store_id = $1 AND action = 'SHIPMENT_OVERRIDE' AND entity_type = 'SHIPMENT' AND entity_id = $2
         ORDER BY created_at DESC LIMIT 1`,
        session.storeId, shipmentId,
      );
      const approved = overrideRows.length > 0;
      if (currentCount !== lockedShipment.expectedPacks && !approved) {
        throw new ShipmentActivationError(`Expected ${lockedShipment.expectedPacks} packs but scanned ${currentCount}.`, 400);
      }

      const currentRetailValue = currentPacks.reduce(
        (sum, pack) => sum + Number(pack.ticketPrice ?? 0) * Number(pack.ticketQuantity ?? 0), 0,
      );
      const currentCost = Math.round(currentRetailValue * 0.95 * 100) / 100;
      if (Math.round(parsedExpectedInventoryCost * 100) !== Math.round(currentCost * 100) && !approved) {
        throw new ShipmentActivationError(`Expected inventory cost ($${parsedExpectedInventoryCost.toFixed(2)}) does not match the calculated 95% cost ($${currentCost.toFixed(2)}).`, 400);
      }

      const packsUpdated = await tx.pack.updateMany({
        where: { shipmentId, storeId: session.storeId, status: "RECEIVING" },
        data: { status: "BACK_STOCK" },
      });
      if (packsUpdated.count !== currentCount) throw new ShipmentActivationError("Shipment packs changed during confirmation. Refresh and try again.");

      return tx.shipment.update({
        where: { id: shipmentId },
        data: { scannedPacks: currentCount, status: "RECEIVED", confirmedAt: new Date() },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return NextResponse.json(updatedShipment);
  } catch (error) {
    if (error instanceof ShipmentActivationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2034") {
      return NextResponse.json({ error: "Shipment changed during confirmation. Refresh before trying again." }, { status: 409 });
    }
    console.error(error);

    return NextResponse.json(
      { error: "Failed to confirm shipment." },
      { status: 500 }
    );
  }
}
