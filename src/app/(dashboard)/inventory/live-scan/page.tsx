import { Header } from "@/components/layout/header";
import { prisma } from "@/lib/prisma";
import { LiveScanDashboard } from "@/components/inventory/live-scan-dashboard";
import { getSession } from "@/lib/get-session";

export default async function LiveScanPage() {
  const session = await getSession();

  if (!session) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          title="Live Scan"
          subtitle="Real-time ticket scanning and sales tracking"
        />
        <div className="flex-1 overflow-y-auto px-4 py-3.5">
          <div className="rounded-lg border-2 border-dashed border-red-300 bg-red-50 p-6 text-center">
            <p className="text-red-600 font-medium">Not authenticated</p>
          </div>
        </div>
      </div>
    );
  }

  // Fetch current shift for the store
  const currentShift = await prisma.shift.findFirst({
    where: {
      status: "OPEN",
      storeId: session.storeId,
    },
    include: {
      openedBy: true,
      lines: {
        include: {
          pack: {
            include: {
              game: true,
              slot: true,
            },
          },
        },
        orderBy: {
          id: "desc",
        },
      },
    },
    orderBy: {
      openedAt: "desc",
    },
  });

  // Fetch active packs for the store
  const activePacks = await prisma.pack.findMany({
    where: {
      status: "ACTIVE",
      shipment: {
        storeId: session.storeId,
      },
    },
    include: {
      game: true,
      slot: true,
    },
    orderBy: {
      activatedAt: "desc",
    },
  });

  const shiftData = currentShift ? JSON.parse(
    JSON.stringify(currentShift, (_, value) =>
      typeof value === "bigint"
        ? value.toString()
        : value
    )
  ) : null;

  const packsData = JSON.parse(
    JSON.stringify(activePacks, (_, value) =>
      typeof value === "bigint"
        ? value.toString()
        : value
    )
  );

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Header
        title="Live Scan"
        subtitle="Real-time ticket scanning and sales tracking"
      />

      <div className="flex-1 overflow-y-auto px-4 py-3.5">
        <LiveScanDashboard
          currentShift={shiftData}
          activePacks={packsData}
        />
      </div>
    </div>
  );
}
