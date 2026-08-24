import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/get-session";
import { canReceiveShipments } from "@/lib/permissions";

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
        { error: "You do not have permission to receive shipments." },
        { status: 403 }
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
      return NextResponse.json({
        success: true,
        reused: true,
        ...existingShipment,
      });
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

    

    console.log("Shipment created:", shipment);

    return NextResponse.json({
      success: true,
      ...shipment,
    });
  } catch (error: unknown) {
    console.error("Shipment creation failed:");
    console.error(error);

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