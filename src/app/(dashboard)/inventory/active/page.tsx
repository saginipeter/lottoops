import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { ActiveStockTable } from "@/components/inventory/active-stock-table";

export default async function ActiveStockPage() {
  const packs = await prisma.pack.findMany({
    where: {
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
  });

  const activePacks = JSON.parse(
    JSON.stringify(packs, (_, value) =>
      typeof value === "bigint"
        ? value.toString()
        : value
    )
  );

  return (
    <div className="flex flex-1 flex-col overflow-hidden">

      <Header
        title="Active Stock"
        subtitle={`${activePacks.length} active lottery packs`}
        actions={
          <Link href="/inventory/back-stock">
            <Button>
              Back Stock
            </Button>
          </Link>
        }
      />

      <div className="flex-1 overflow-y-auto px-4 py-4">

        <Panel>

          <ActiveStockTable packs={activePacks} />

        </Panel>

      </div>

    </div>
  );
}