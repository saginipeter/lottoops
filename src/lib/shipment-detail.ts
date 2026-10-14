import type { ShipmentReportData } from "@/lib/shipment-report";
import { shipmentFinancialTotals } from "@/lib/shipment-report";

interface ShipmentReader {
  shipment: {
    findFirst(args: {
      where: { id: string; storeId: string };
      include: {
        receivedBy: { select: { name: true } };
        store: { select: { name: true; storeNumber: true; address: true; phone: true; timezone: true } };
        packs: { where: { storeId: string }; include: { game: { select: { name: true } } }; orderBy: { receivedAt: "asc" } };
      };
    }): Promise<ShipmentReportData | null>;
  };
}

export async function readShipmentDetail(db: ShipmentReader, id: string, storeId: string) {
  const shipment = await db.shipment.findFirst({
    where: { id, storeId },
    include: {
      receivedBy: { select: { name: true } },
      store: { select: { name: true, storeNumber: true, address: true, phone: true, timezone: true } },
      packs: { where: { storeId }, include: { game: { select: { name: true } } }, orderBy: { receivedAt: "asc" } },
    },
  });
  return shipment ? { ...shipment, totals: shipmentFinancialTotals(shipment) } : null;
}
