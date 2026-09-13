import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
]);

function safeFileExtension(fileName: string, contentType: string): string {
  const extension = fileName.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (extension && extension.length <= 8) return extension;
  return contentType === "application/pdf" ? "pdf" : contentType.split("/")[1] ?? "bin";
}

export async function POST(req: Request) {
  try {
    const session = await getApiSession();
    if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.error("[POST /api/upload] BLOB_READ_WRITE_TOKEN is not configured.");
      return NextResponse.json(
        { error: "File storage is not configured. Set BLOB_READ_WRITE_TOKEN in the deployment environment." },
        { status: 503 },
      );
    }

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: "Only JPEG, PNG, WebP, HEIC, and PDF files are allowed." }, { status: 415 });
    }
    if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "Files must be between 1 byte and 10 MB." }, { status: 413 });
    }

    const type = String(formData.get("type") ?? "Supporting Document").trim().slice(0, 80);
    const name = String(formData.get("name") ?? file.name).trim().slice(0, 240) || file.name;
    const reference = String(formData.get("reference") ?? "").trim().slice(0, 160) || null;
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
    if (retentionUntil && retentionUntil.getTime() < documentDate.getTime()) {
      return NextResponse.json({ error: "retentionUntil cannot be before documentDate." }, { status: 400 });
    }

    if (packId) {
      const pack = await prisma?.pack.findFirst({ where: { id: packId, storeId: session.storeId }, select: { id: true } });
      if (!pack) return NextResponse.json({ error: "Pack not found for this store." }, { status: 404 });
    }
    if (shipmentId) {
      const shipment = await prisma?.shipment.findFirst({ where: { id: shipmentId, storeId: session.storeId }, select: { id: true } });
      if (!shipment) return NextResponse.json({ error: "Shipment not found for this store." }, { status: 404 });
    }

    const pathname = `stores/${session.storeId}/documents/${crypto.randomUUID()}.${safeFileExtension(file.name, file.type)}`;
    const blob = await put(pathname, file, {
      access: "public",
      addRandomSuffix: false,
      contentType: file.type,
    });

    const url = blob.url;
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
            url,
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

    return NextResponse.json({ success: true, url, document, warning });
  } catch (error) {
    console.error("Blob upload error:", error);
    const message = error instanceof Error ? error.message : "";
    const storageError = /blob|token|storage|upload/i.test(message);
    return NextResponse.json(
      {
        success: false,
        error: storageError
          ? "Image storage rejected the upload. Verify the production BLOB_READ_WRITE_TOKEN and Vercel Blob store configuration."
          : "Upload failed while saving the document. Check the production database and migrations.",
      },
      { status: storageError ? 502 : 500 },
    );
  }
}
