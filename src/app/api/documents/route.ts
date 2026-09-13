import { NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";
import { canAccessReports } from "@/lib/permissions";
import type { Document as PrismaDocument } from "@prisma/client";

interface DocumentRow { id: string; type: string; name: string; url: string; createdAt: Date; documentDate: Date; retentionUntil: Date | null; reference: string; uploadedByName?: string | null; source: "stored" | "legacy" }

export async function GET(request: NextRequest) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!canAccessReports(session)) return NextResponse.json({ error: "Document access required." }, { status: 403 });
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const query = request.nextUrl.searchParams.get("q")?.trim().toLowerCase() ?? "";
  const type = request.nextUrl.searchParams.get("type")?.trim() ?? "";
  const fromValue = request.nextUrl.searchParams.get("from")?.trim() ?? "";
  const toValue = request.nextUrl.searchParams.get("to")?.trim() ?? "";
  const retention = request.nextUrl.searchParams.get("retention")?.trim() ?? "";
  const from = fromValue ? new Date(`${fromValue}T00:00:00`) : null;
  const to = toValue ? new Date(`${toValue}T23:59:59`) : null;
  if ((fromValue && (!from || Number.isNaN(from.getTime()))) || (toValue && (!to || Number.isNaN(to.getTime())))) {
    return NextResponse.json({ error: "Document date filters must be valid dates." }, { status: 400 });
  }
  try {
    let storedDocuments: Array<PrismaDocument & { uploadedBy: { name: string } }> = [];
    let warning: string | null = null;
    try {
      storedDocuments = await prisma.document.findMany({ where: { storeId: session.storeId, ...(type ? { type } : {}), ...(from || to ? { documentDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}) }, include: { uploadedBy: { select: { name: true } } }, orderBy: { documentDate: "desc" }, take: 1000 });
    } catch (error) {
      console.error("[GET /api/documents] Document history query failed:", error);
      warning = "Document history is unavailable until the latest database migrations are applied.";
    }
    const [shipmentsResult, packsResult] = await Promise.all([
      prisma.shipment.findMany({ where: { storeId: session.storeId }, select: { id: true, invoiceNumber: true, invoicePhoto: true, confirmationReceiptPhoto: true, createdAt: true, shipmentDate: true }, orderBy: { createdAt: "desc" }, take: 250 }),
      prisma.pack.findMany({ where: { storeId: session.storeId }, select: { id: true, serialNumber: true, gameNumber: true, packImage: true, activationReceipt: true, activationReceiptPhoto: true, invoiceReceipt: true, receivedAt: true }, orderBy: { receivedAt: "desc" }, take: 500 }),
    ]);
    const shipments = shipmentsResult as Array<{ id: string; invoiceNumber: string; invoicePhoto: string | null; confirmationReceiptPhoto: string | null; createdAt: Date; shipmentDate: Date | null }>;
    const packs = packsResult as Array<{ id: string; serialNumber: string; gameNumber: string | null; packImage: string | null; activationReceipt: string | null; activationReceiptPhoto: string | null; invoiceReceipt: string | null; receivedAt: Date }>;
    const documents: DocumentRow[] = [
      ...storedDocuments.map((document: PrismaDocument & { uploadedBy: { name: string } }) => ({
        id: document.id,
        type: document.type,
        name: document.name,
        url: document.url,
        createdAt: document.createdAt,
        documentDate: document.documentDate,
        retentionUntil: document.retentionUntil,
        reference: document.reference ?? "",
        uploadedByName: document.uploadedBy.name,
        source: "stored" as const,
      })),
      ...shipments.flatMap((shipment) => [
        ...(shipment.invoicePhoto ? [{ id: `invoice-${shipment.id}`, type: "Invoice", name: `Invoice ${shipment.invoiceNumber}`, url: shipment.invoicePhoto, createdAt: shipment.createdAt, documentDate: shipment.shipmentDate ?? shipment.createdAt, retentionUntil: null, reference: shipment.invoiceNumber, source: "legacy" as const }] : []),
        ...(shipment.confirmationReceiptPhoto ? [{ id: `confirmation-${shipment.id}`, type: "Confirmation Receipt", name: `Confirmation ${shipment.invoiceNumber}`, url: shipment.confirmationReceiptPhoto, createdAt: shipment.createdAt, documentDate: shipment.shipmentDate ?? shipment.createdAt, retentionUntil: null, reference: shipment.invoiceNumber, source: "legacy" as const }] : []),
      ]),
      ...packs.flatMap((pack) => [
        ...(pack.packImage ? [{ id: `pack-${pack.id}`, type: "Pack Image", name: `Pack ${pack.serialNumber}`, url: pack.packImage, createdAt: pack.receivedAt, documentDate: pack.receivedAt, retentionUntil: null, reference: `${pack.gameNumber ?? "Game"} · ${pack.serialNumber}`, source: "legacy" as const }] : []),
        ...(pack.activationReceipt ? [{ id: `activation-${pack.id}`, type: "Activation Receipt", name: `Activation ${pack.serialNumber}`, url: pack.activationReceipt, createdAt: pack.receivedAt, documentDate: pack.receivedAt, retentionUntil: null, reference: pack.serialNumber, source: "legacy" as const }] : []),
        ...(pack.activationReceiptPhoto ? [{ id: `activation-photo-${pack.id}`, type: "Activation Receipt", name: `Activation ${pack.serialNumber}`, url: pack.activationReceiptPhoto, createdAt: pack.receivedAt, documentDate: pack.receivedAt, retentionUntil: null, reference: pack.serialNumber, source: "legacy" as const }] : []),
        ...(pack.invoiceReceipt ? [{ id: `pack-invoice-${pack.id}`, type: "Pack Invoice", name: `Invoice ${pack.serialNumber}`, url: pack.invoiceReceipt, createdAt: pack.receivedAt, documentDate: pack.receivedAt, retentionUntil: null, reference: pack.serialNumber, source: "legacy" as const }] : []),
      ]),
    ];
    const visible = documents.filter((document) => {
      const matchesQuery = !query || `${document.type} ${document.name} ${document.reference}`.toLowerCase().includes(query);
      const matchesType = !type || document.type === type;
      const date = document.documentDate.getTime();
      const matchesFrom = !from || date >= from.getTime();
      const matchesTo = !to || date <= to.getTime();
      const matchesRetention = retention === "expired" ? Boolean(document.retentionUntil && document.retentionUntil.getTime() < Date.now()) : retention === "active" ? !document.retentionUntil || document.retentionUntil.getTime() >= Date.now() : true;
      return matchesQuery && matchesType && matchesFrom && matchesTo && matchesRetention;
    }).sort((a, b) => b.documentDate.getTime() - a.documentDate.getTime());
    return NextResponse.json({ documents: visible, warning });
  } catch (error) {
    console.error("[GET /api/documents]", error);
    return NextResponse.json({ error: "Unable to load documents." }, { status: 500 });
  }
}
