import { getSession } from "@/lib/get-session";
import { prisma } from "@/lib/prisma";
import { InventoryPos, type InventoryPack } from "@/components/inventory/inventory-pos";

type LivePackRow = {
  id: string;
  game: { name: string; gameNumber: string; price: unknown; ticketsPerPack: number };
  serialNumber: string;
  ticketPrice: unknown;
  ticketQuantity: number | null;
  currentTicketNumber: number | null;
  slot: { slotNumber: string } | null;
  firstOrLastTicket: string | null;
  shipment: { invoiceNumber: string } | null;
  receivedAt: Date;
  status: "ACTIVE" | "BACK_STOCK";
};

export default async function InventoryPage() {
  const session = await getSession();
  if (!session) return null;

  const packs = await prisma.pack.findMany({
    where: { storeId: session.storeId, status: { in: ["BACK_STOCK", "ACTIVE"] } },
    include: { game: true, shipment: true, slot: true },
    orderBy: { receivedAt: "desc" },
  });

  const inventory: InventoryPack[] = packs.map((pack: LivePackRow) => ({
    id: pack.id,
    game: pack.game.name,
    gameNumber: pack.game.gameNumber,
    serial: pack.serialNumber,
    price: Number(pack.ticketPrice ?? pack.game.price ?? 0),
    tickets: Number(pack.ticketQuantity ?? pack.game.ticketsPerPack ?? 0),
    currentTicket: Number(pack.currentTicketNumber ?? pack.ticketQuantity ?? pack.game.ticketsPerPack ?? 0),
    location: pack.slot?.slotNumber ? `Display ${pack.slot.slotNumber}` : "Back Stock",
    status: pack.status === "ACTIVE" ? "ACTIVE" : "BACK_STOCK",
    direction: pack.firstOrLastTicket === "LAST" ? "LAST" : "FIRST",
    invoice: pack.shipment?.invoiceNumber ?? "",
    receivedAt: pack.receivedAt.toISOString(),
  }));

  return <InventoryPos employeeName={session.name} storeName={session.storeName ?? "LottoOps Store"} packs={inventory} />;
}
