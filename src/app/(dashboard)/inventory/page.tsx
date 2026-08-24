import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { BackStockList } from "@/components/inventory/back-stock-list";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/get-session";
import { Plus } from "lucide-react";
import { canManageBackstock, canReceiveShipments } from "@/lib/permissions";

export default async function InventoryPage() {
 const session = await getSession();

 if (!session) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Header title="Back Stock" subtitle="Not authenticated" />
      <div className="flex-1 overflow-y-auto px-4 py-3.5">
        <div className="rounded-lg border-2 border-dashed border-red-300 bg-red-50 p-6 text-center">
          <p className="text-red-600 font-medium">Not authenticated</p>
        </div>
      </div>
    </div>
  );
 }

 const packs = await prisma.pack.findMany({
  where: {
    storeId: session.storeId,
    status: "BACK_STOCK",
  },
  include: {
    game: true,
    shipment: true,
    receivedBy: true,
  },
  orderBy: {
    receivedAt: "desc",
  },
});

const slots = await prisma.displaySlot.findMany({
  where: {
    storeId: session.storeId,
  },
  select: {
    id: true,
    slotNumber: true,
    packId: true,
  },
  orderBy: {
    slotNumber: "asc",
  },
});

const backStock = JSON.parse(
  JSON.stringify(packs, (_, value) =>
    typeof value === "bigint"
      ? value.toString()
      : value
  )
);

const displaySlots = slots.map((slot: { id: string; slotNumber: string; packId: string | null }) => ({
  id: slot.id,
  slotNumber: slot.slotNumber,
  occupied: Boolean(slot.packId),
}));

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Header
        title="Back Stock"
        subtitle={`${backStock.length} packs waiting to be activated`}
        actions={
          canReceiveShipments(session) && (
            <Link href="/inventory/receive">
              <Button variant="default">
                <Plus size={14} />
                Receive Inventory
              </Button>
            </Link>
          )
        }
      />
      <BackStockList
        packs={backStock}
        slots={displaySlots}
        canManageBackstock={canManageBackstock(session)}
      />
    </div>
  );
}
