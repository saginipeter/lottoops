import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { ActiveStockTable } from "@/components/inventory/active-stock-table";
import { getSession } from "@/lib/get-session";
import { canManageDisplay } from "@/lib/permissions";
import { getDisplaySlots } from "@/lib/services/display-slots";

export default async function ActiveStockPage() {
  const session = await getSession();
  if (!session) return null;

  const [packs, displaySlots] = await Promise.all([prisma.pack.findMany({
    where: {
      storeId: session.storeId,
      status: "ACTIVE",
    },
    include: {
      game: true,
      shipment: true,
      slot: true,
      receivedBy: true,
    },
    orderBy: {
      activatedAt: "desc",
    },
  }), getDisplaySlots(session.storeId)]);

  const activePacks = JSON.parse(
    JSON.stringify(packs, (_, value) =>
      typeof value === "bigint"
        ? value.toString()
        : value
    )
  );
  const slots = displaySlots.map((slot: { id: string; slotNumber: string; packId: string | null }) => ({
    id: slot.id,
    slotNumber: slot.slotNumber,
    occupied: Boolean(slot.packId),
  }));

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">

      <Header
        title="Active Stock"
        subtitle={`${activePacks.length} active lottery packs`}
        actions={
          <Link href="/inventory">
            <Button>
              Back Stock
            </Button>
          </Link>
        }
      />

      <ActiveStockTable packs={activePacks} canManageDisplay={canManageDisplay(session)} slots={slots} />

    </div>
  );
}