import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { PageToolbar } from "@/components/ui/page-toolbar";
import { StatusBar } from "@/components/ui/status-bar";
import { PackDetailsCard } from "@/components/inventory/pack-details-card";
import { ShipmentCard } from "@/components/inventory/shipment-card";
import { PackStatsCard } from "@/components/inventory/pack-stats-card";
import { PackActions } from "@/components/inventory/pack-actions";
import { ScanTimeline } from "@/components/inventory/scan-timeline";

interface Props {
  params: Promise<{
    id: string;
  }>;
}

export default async function PackDetailsPage({
  params,
}: Props) {

  const { id } = await params;

  const pack = await prisma.pack.findUnique({
    where: {
      id,
    },
    include: {
      game: true,
      shipment: true,
      slot: true,
      receivedBy: true,

      scanLogs: {
        orderBy: {
          timestamp: "desc",
        },
      },
    },
  });

  if (!pack) {
    notFound();
  }

  const data = JSON.parse(
    JSON.stringify(pack)
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">

      <Header
        title={`Pack ${pack.packNumber}`}
        subtitle={pack.game.name}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/inventory">Back to Inventory</Link>
          </Button>
        }
      />

      <PageToolbar
        left={<span className="text-xs text-text-secondary">Serial: {pack.serialNumber}</span>}
        center={<span>Lifecycle details and activity timeline</span>}
        right={<span className="text-xs text-text-tertiary">Status: {pack.status}</span>}
      />

      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">

          <div className="space-y-6 xl:col-span-2">

            <PackDetailsCard pack={data} />

            <ShipmentCard pack={data} />

            <ScanTimeline logs={data.scanLogs} />

          </div>

          <div className="space-y-6">

            <PackStatsCard pack={data} />

            <PackActions pack={data} />

          </div>

        </div>
      </div>

      <StatusBar
        left={<span>Game: {pack.game.name}</span>}
        center={<span>Scan Events: {pack.scanLogs.length}</span>}
        right={<span>Received: {new Date(pack.receivedAt).toLocaleDateString()}</span>}
      />

    </div>
  );
}