import { NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";
import { canAccessReports } from "@/lib/permissions";

interface DocumentRow { id: string; type: string; name: string; url: string; createdAt: Date; reference: string }

export async function GET(request: NextRequest) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!canAccessReports(session)) return NextResponse.json({ error: "Document access required." }, { status: 403 });
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const query = request.nextUrl.searchParams.get("q")?.trim().toLowerCase() ?? "";
  try {
    const [shipmentsResult, packsResult] = await Promise.all([
      prisma.shipment.findMany({ where: { storeId: session.storeId }, select: { id: true, invoiceNumber: true, invoicePhoto: true, confirmationReceiptPhoto: true, createdAt: true, shipmentDate: true }, orderBy: { createdAt: "desc" }, take: 250 }),
      prisma.pack.findMany({ where: { storeId: session.storeId }, select: { id: true, serialNumber: true, gameNumber: true, packImage: true, activationReceipt: true, activationReceiptPhoto: true, invoiceReceipt: true, receivedAt: true }, orderBy: { receivedAt: "desc" }, take: 500 }),
    ]);
    const shipments = shipmentsResult as Array<{ id: string; invoiceNumber: string; invoicePhoto: string | null; confirmationReceiptPhoto: string | null; createdAt: Date; shipmentDate: Date | null }>;
    const packs = packsResult as Array<{ id: string; serialNumber: string; gameNumber: string | null; packImage: string | null; activationReceipt: string | null; activationReceiptPhoto: string | null; invoiceReceipt: string | null; receivedAt: Date }>;
    const documents: DocumentRow[] = [
      ...shipments.flatMap((shipment) => [
        ...(shipment.invoicePhoto ? [{ id: `invoice-${shipment.id}`, type: "Invoice", name: `Invoice ${shipment.invoiceNumber}`, url: shipment.invoicePhoto, createdAt: shipment.createdAt, reference: shipment.invoiceNumber }] : []),
        ...(shipment.confirmationReceiptPhoto ? [{ id: `confirmation-${shipment.id}`, type: "Confirmation Receipt", name: `Confirmation ${shipment.invoiceNumber}`, url: shipment.confirmationReceiptPhoto, createdAt: shipment.createdAt, reference: shipment.invoiceNumber }] : []),
      ]),
      ...packs.flatMap((pack) => [
        ...(pack.packImage ? [{ id: `pack-${pack.id}`, type: "Pack Image", name: `Pack ${pack.serialNumber}`, url: pack.packImage, createdAt: pack.receivedAt, reference: `${pack.gameNumber ?? "Game"} · ${pack.serialNumber}` }] : []),
        ...(pack.activationReceipt ? [{ id: `activation-${pack.id}`, type: "Activation Receipt", name: `Activation ${pack.serialNumber}`, url: pack.activationReceipt, createdAt: pack.receivedAt, reference: pack.serialNumber }] : []),
        ...(pack.activationReceiptPhoto ? [{ id: `activation-photo-${pack.id}`, type: "Activation Receipt", name: `Activation ${pack.serialNumber}`, url: pack.activationReceiptPhoto, createdAt: pack.receivedAt, reference: pack.serialNumber }] : []),
        ...(pack.invoiceReceipt ? [{ id: `pack-invoice-${pack.id}`, type: "Pack Invoice", name: `Invoice ${pack.serialNumber}`, url: pack.invoiceReceipt, createdAt: pack.receivedAt, reference: pack.serialNumber }] : []),
      ]),
    ];
    const visible = documents.filter((document) => !query || `${document.type} ${document.name} ${document.reference}`.toLowerCase().includes(query)).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return NextResponse.json({ documents: visible });
  } catch (error) {
    console.error("[GET /api/documents]", error);
    return NextResponse.json({ error: "Unable to load documents." }, { status: 500 });
  }
}
