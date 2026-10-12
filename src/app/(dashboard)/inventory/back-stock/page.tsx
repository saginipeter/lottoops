import { redirect } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { BackStockList } from "@/components/inventory/back-stock-list";
import { getSession } from "@/lib/get-session";
import { canManageBackstock } from "@/lib/permissions";
import { getDisplaySlots } from "@/lib/services/display-slots";
import { prisma } from "@/lib/prisma";

export default async function BackStockPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!canManageBackstock(session)) redirect("/");

  const [packs, displaySlots] = await Promise.all([
    prisma.pack.findMany({
      where: { storeId: session.storeId, status: "BACK_STOCK" },
      include: { game: true, shipment: true },
      orderBy: { receivedAt: "desc" },
    }),
    getDisplaySlots(session.storeId),
  ]);
  const serializedPacks = JSON.parse(
    JSON.stringify(packs, (_, value) =>
      typeof value === "bigint"
        ? value.toString()
        : value && typeof value === "object" && value.constructor?.name === "Decimal"
          ? Number(value)
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
        title="Back Stock"
        subtitle={`${packs.length} packs awaiting activation`}
        actions={
          <Link href="/inventory/active">
            <Button variant="secondary">Active Stock</Button>
          </Link>
        }
      />
      <BackStockList
        packs={serializedPacks}
        slots={slots}
        canManageBackstock={canManageBackstock(session)}
      />
    </div>
  );
}
