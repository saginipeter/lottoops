import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getApiSession } from "@/lib/api-session";
import { canReceiveShipments, canManageBackstock } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canReceiveShipments(session) && !canManageBackstock(session)) {
    return NextResponse.json({ error: "You do not have permission to view shipments." }, { status: 403 });
  }
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const status = req.nextUrl.searchParams.get("status")?.trim();
  const shipments = await prisma.shipment.findMany({
    where: {
      storeId: session.storeId,
      ...(status === "IN_PROGRESS" || status === "RECEIVED" ? { status } : {}),
    },
    include: {
      receivedBy: { select: { name: true } },
      _count: { select: { packs: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ shipments });
}

export async function POST(req: NextRequest) {
  try {
    const session = await getApiSession();

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (!canReceiveShipments(session)) {
      return NextResponse.json(
        { error: "You do not have permission to receive shipments." },
        { status: 403 }
      );
    }

    const body = await req.json();

    const {
      invoiceNumber,
      invoicePhoto,
      shipmentConfirmationNumber,
      confirmationReceiptPhoto,
      expectedPacks,
      shipmentDate,
    } = body;

    const normalizedInvoiceNumber = String(invoiceNumber ?? "").trim();
    const normalizedConfirmationNumber = String(
      shipmentConfirmationNumber ?? ""
    ).trim();
    const normalizedInvoicePhoto = String(invoicePhoto ?? "").trim();
    const normalizedConfirmationPhoto = String(
      confirmationReceiptPhoto ?? ""
    ).trim();

    // Validation
    if (!normalizedInvoiceNumber) {
      return NextResponse.json(
        { error: "Invoice number is required." },
        { status: 400 }
      );
    }

    if (!normalizedInvoicePhoto) {
      return NextResponse.json(
        { error: "Invoice photo is required." },
        { status: 400 }
      );
    }

    if (!normalizedConfirmationNumber) {
      return NextResponse.json(
        { error: "Shipment confirmation number is required." },
        { status: 400 }
      );
    }

    if (!normalizedConfirmationPhoto) {
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

    let parsedShipmentDate: Date | undefined;
    if (shipmentDate) {
      parsedShipmentDate = new Date(shipmentDate);
      if (Number.isNaN(parsedShipmentDate.getTime())) {
        return NextResponse.json(
          { error: "Shipment date is invalid." },
          { status: 400 }
        );
      }
    }

    const existingShipment = await prisma.shipment.findFirst({
      where: {
        storeId: session.storeId,
        invoiceNumber: normalizedInvoiceNumber,
        status: "IN_PROGRESS",
      },
    });

    if (existingShipment) {
      const existingPackCount = await prisma.pack.count({
        where: {
          storeId: session.storeId,
          shipmentId: existingShipment.id,
        },
      });

      const normalizedExpectedPacks = Number(expectedPacks);
      if (
        existingPackCount > 0 ||
        existingShipment.expectedPacks !== normalizedExpectedPacks
      ) {
        return NextResponse.json(
          {
            error:
              `Invoice ${normalizedInvoiceNumber} already has an in-progress shipment with ${existingPackCount} scanned pack(s). ` +
              "Use a new invoice number, or finish/cancel the existing shipment before starting a new one.",
          },
          { status: 409 }
        );
      }

      return NextResponse.json({ success: true, reused: true, ...existingShipment });
    }

    let shipment;
    try {
      shipment = await prisma.shipment.create({
        data: {
          invoiceNumber: normalizedInvoiceNumber,
          invoicePhoto: normalizedInvoicePhoto,
          shipmentConfirmationNumber: normalizedConfirmationNumber,
          confirmationReceiptPhoto: normalizedConfirmationPhoto,
          expectedPacks: Number(expectedPacks),
          shipmentDate: parsedShipmentDate,
          scannedPacks: 0,
          storeId: session.storeId,
          receivedById: session.userId,
        },
      });
    } catch (createError: unknown) {
      if (
        createError instanceof Prisma.PrismaClientKnownRequestError &&
        (createError.code === "P2021" || createError.code === "P2022")
      ) {
        // Temporary compatibility path when production DB is behind the app schema.
        shipment = await prisma.shipment.create({
          data: {
            invoiceNumber: normalizedInvoiceNumber,
            invoicePhoto: normalizedInvoicePhoto,
            expectedPacks: Number(expectedPacks),
            scannedPacks: 0,
            storeId: session.storeId,
            receivedById: session.userId,
          },
        });
      } else {
        throw createError;
      }
    }

    

    return NextResponse.json({
      success: true,
      ...shipment,
    });
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return NextResponse.json(
          {
            error:
              "This invoice already exists for your store. Open the existing in-progress shipment or use a new invoice number.",
          },
          { status: 409 }
        );
      }

      if (error.code === "P2021" || error.code === "P2022") {
        return NextResponse.json(
          {
            error:
              "Database schema is out of date in this environment. Run Prisma migrations on production (prisma migrate deploy), then redeploy.",
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to create shipment",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getApiSession();
    if (!session || !canReceiveShipments(session)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { shipmentId, invoiceNumber } = await req.json();
    const normalizedInvoiceNumber = String(invoiceNumber ?? "").trim();

    if (
      (!shipmentId || typeof shipmentId !== "string") &&
      !normalizedInvoiceNumber
    ) {
      return NextResponse.json(
        { error: "Shipment ID or invoice number is required." },
        { status: 400 }
      );
    }

    const shipment = await prisma.shipment.findFirst({
      where: {
        storeId: session.storeId,
        status: "IN_PROGRESS",
        ...(shipmentId && typeof shipmentId === "string"
          ? { id: shipmentId }
          : { invoiceNumber: normalizedInvoiceNumber }),
      },
      select: { id: true },
    });
    if (!shipment) {
      // Nothing blocking on the server for this invoice/id — treat as already cleared.
      return NextResponse.json({ success: true, cleared: false });
    }

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Packs already referenced by a sale (shift line) or an inventory audit
      // can't be hard-deleted (FK restrict) — detach them from the shipment
      // instead so the shipment record itself can be removed cleanly.
      const blockedPacks = await tx.pack.findMany({
        where: {
          shipmentId: shipment.id,
          OR: [{ shiftLines: { some: {} } }, { auditLines: { some: {} } }],
        },
        select: { id: true },
      });
      const blockedPackIds = blockedPacks.map((pack: { id: string }) => pack.id);

      if (blockedPackIds.length > 0) {
        await tx.pack.updateMany({
          where: { id: { in: blockedPackIds } },
          data: { shipmentId: null },
        });
      }

      await tx.pack.deleteMany({
        where: {
          shipmentId: shipment.id,
          id: { notIn: blockedPackIds },
        },
      });
      await tx.shipment.delete({ where: { id: shipment.id } });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Shipment draft deletion failed:", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.json(
        {
          error:
            "Some packs on this shipment are already referenced by a sale or audit and couldn't be removed. Please contact support.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json({ error: "Unable to clear shipment draft." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getApiSession();
    if (!session || !(canReceiveShipments(session) || canManageBackstock(session))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { shipmentId, invoiceNumber, shipmentConfirmationNumber } = await req.json();

    if (!shipmentId || typeof shipmentId !== "string") {
      return NextResponse.json({ error: "Shipment ID is required." }, { status: 400 });
    }

    const normalizedInvoiceNumber = String(invoiceNumber ?? "").trim();
    if (!normalizedInvoiceNumber) {
      return NextResponse.json(
        { error: "Invoice number is required." },
        { status: 400 }
      );
    }

    const shipment = await prisma.shipment.findFirst({
      where: { id: shipmentId, storeId: session.storeId },
      select: { id: true, invoiceNumber: true },
    });
    if (!shipment) {
      return NextResponse.json({ error: "Shipment not found." }, { status: 404 });
    }

    if (normalizedInvoiceNumber !== shipment.invoiceNumber) {
      const conflict = await prisma.shipment.findFirst({
        where: {
          storeId: session.storeId,
          invoiceNumber: normalizedInvoiceNumber,
          NOT: { id: shipment.id },
        },
        select: { id: true },
      });
      if (conflict) {
        return NextResponse.json(
          { error: `Invoice ${normalizedInvoiceNumber} is already used by another shipment.` },
          { status: 409 }
        );
      }
    }

    const updated = await prisma.shipment.update({
      where: { id: shipment.id },
      data: {
        invoiceNumber: normalizedInvoiceNumber,
        ...(shipmentConfirmationNumber !== undefined
          ? { shipmentConfirmationNumber: String(shipmentConfirmationNumber ?? "").trim() || null }
          : {}),
      },
    });

    return NextResponse.json({ success: true, ...updated });
  } catch (error) {
    console.error("Shipment update failed:", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "This invoice number is already in use for your store." },
        { status: 409 }
      );
    }

    return NextResponse.json({ error: "Unable to update shipment." }, { status: 500 });
  }
}
