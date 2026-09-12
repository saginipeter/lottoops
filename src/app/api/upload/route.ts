import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const session = await getApiSession();
    if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.error("[POST /api/upload] BLOB_READ_WRITE_TOKEN is not configured.");
      return NextResponse.json(
        { error: "Image storage is not configured. Set BLOB_READ_WRITE_TOKEN in the deployment environment." },
        { status: 503 }
      );
    }
    const formData = await req.formData();

    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file uploaded" },
        { status: 400 }
      );
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Only image files can be uploaded." }, { status: 415 });
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "Image must be 10 MB or smaller." }, { status: 413 });
    }

    const type = String(formData.get("type") ?? "Supporting Document").trim();
    const name = String(formData.get("name") ?? file.name).trim() || file.name;
    const reference = String(formData.get("reference") ?? "").trim() || null;
    const packId = String(formData.get("packId") ?? "").trim() || null;
    const shipmentId = String(formData.get("shipmentId") ?? "").trim() || null;
    const retentionUntilValue = String(formData.get("retentionUntil") ?? "").trim();
    const retentionUntil = retentionUntilValue ? new Date(retentionUntilValue) : null;
    const documentDateValue = String(formData.get("documentDate") ?? "").trim();
    const documentDate = documentDateValue ? new Date(documentDateValue) : new Date();
    if (documentDateValue && Number.isNaN(documentDate.getTime())) {
      return NextResponse.json({ error: "documentDate must be a valid date." }, { status: 400 });
    }
    if (retentionUntilValue && (!retentionUntil || Number.isNaN(retentionUntil.getTime()))) {
      return NextResponse.json({ error: "retentionUntil must be a valid date." }, { status: 400 });
    }

    if (packId) {
      const pack = await prisma?.pack.findFirst({ where: { id: packId, storeId: session.storeId }, select: { id: true } });
      if (!pack) return NextResponse.json({ error: "Pack not found for this store." }, { status: 404 });
    }
    if (shipmentId) {
      const shipment = await prisma?.shipment.findFirst({ where: { id: shipmentId, storeId: session.storeId }, select: { id: true } });
      if (!shipment) return NextResponse.json({ error: "Shipment not found for this store." }, { status: 404 });
    }

    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const blob = await put(
      `invoices/${Date.now()}-${safeFileName}`,
      file,
      {
        access: "public",
        addRandomSuffix: true,
      }
    );

    let document = null;
    let warning: string | null = null;
    if (prisma) {
      try {
        document = await prisma.document.create({
          data: {
            storeId: session.storeId,
            uploadedById: session.userId,
            type,
            name,
            url: blob.url,
            reference,
            documentDate,
            ...(retentionUntil ? { retentionUntil } : {}),
            packId,
            shipmentId,
          },
        });
      } catch (error) {
        console.error("[POST /api/upload] Document history write failed:", error);
        warning = "Image uploaded, but its document history could not be saved. Apply the latest database migrations.";
      }
    }

    return NextResponse.json({
      success: true,
      url: blob.url,
      document,
      warning,
    });
  } catch (error) {
    console.error("Blob upload error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Upload failed",
      },
      {
        status: 500,
      }
    );
  }
}