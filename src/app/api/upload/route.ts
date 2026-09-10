import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const session = await getApiSession();
    if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const formData = await req.formData();

    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file uploaded" },
        { status: 400 }
      );
    }

    const type = String(formData.get("type") ?? "Supporting Document").trim();
    const name = String(formData.get("name") ?? file.name).trim() || file.name;
    const reference = String(formData.get("reference") ?? "").trim() || null;
    const packId = String(formData.get("packId") ?? "").trim() || null;
    const shipmentId = String(formData.get("shipmentId") ?? "").trim() || null;
    const retentionUntilValue = String(formData.get("retentionUntil") ?? "").trim();
    const retentionUntil = retentionUntilValue ? new Date(retentionUntilValue) : null;
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

    const blob = await put(
      `invoices/${Date.now()}-${file.name}`,
      file,
      {
        access: "public",
        addRandomSuffix: true,
      }
    );

    const document = prisma
        ? await prisma.document.create({
            data: {
              storeId: session.storeId,
              uploadedById: session.userId,
              type,
              name,
              url: blob.url,
              reference,
              ...(retentionUntil ? { retentionUntil } : {}),
              packId,
              shipmentId,
            },
          })
        : null;

    return NextResponse.json({
      success: true,
      url: blob.url,
      document,
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