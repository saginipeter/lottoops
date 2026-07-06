import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

import { Header } from "@/components/layout/header";
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
    <div className="flex flex-1 flex-col overflow-hidden">

      <Header
        title={`Pack ${pack.packNumber}`}
        subtitle={pack.game.name}
      />

      <div className="grid grid-cols-3 gap-6 p-6">

        <div className="col-span-2 space-y-6">

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
  );
}