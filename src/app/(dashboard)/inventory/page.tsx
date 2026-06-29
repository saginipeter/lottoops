import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { BackStockList } from "@/components/inventory/back-stock-list";
import { prisma } from "@/lib/prisma";
import { Plus } from "lucide-react";

export default async function InventoryPage() {
 const packs = await prisma.pack.findMany({
  where: {
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

const backStock = JSON.parse(
  JSON.stringify(packs, (_, value) =>
    typeof value === "bigint"
      ? value.toString()
      : value
  )
);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Header
        title="Back Stock"
        subtitle={`${backStock.length} packs waiting to be activated`}
        actions={
          <Link href="/inventory/receive">
            <Button variant="primary">
              <Plus size={14} />
              Receive Inventory
            </Button>
          </Link>
        }
      />

      <div className="flex-1 overflow-y-auto px-4 py-3.5">
        <Panel>
          <BackStockList packs={backStock} />
        </Panel>
      </div>
    </div>
  );
}
