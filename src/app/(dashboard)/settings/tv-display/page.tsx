import { Header } from "@/components/layout/header";
import { getSession } from "@/lib/get-session";
import { prisma } from "@/lib/prisma";
import { TvDisplayBoard } from "@/components/settings/tv-display-board";

interface TvDisplayPageProps {
  searchParams?: Promise<{
    kiosk?: string;
    interval?: string;
  }>;
}

export default async function TvDisplayPage({ searchParams }: TvDisplayPageProps) {
  const session = await getSession();

  if (!session) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header title="TV Display" subtitle="Not authenticated" />
        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="rounded-lg border-2 border-dashed border-red-300 bg-red-50 p-6 text-center">
            <p className="text-red-600 font-medium">Not authenticated</p>
          </div>
        </div>
      </div>
    );
  }

  const slots = await prisma.displaySlot.findMany({
    where: { storeId: session.storeId },
    include: {
      pack: {
        include: {
          game: true,
        },
      },
    },
    orderBy: { slotNumber: "asc" },
  });

  const activeSlots = slots
    .filter((slot: any) => slot.pack && slot.pack.status === "ACTIVE")
    .map((slot: any) => {
      const pack = slot.pack;
      const quantity = pack.ticketQuantity ?? 0;
      const firstTicket = pack.firstTicket ?? 0;
      const currentTicket = pack.currentTicketNumber ?? firstTicket;
      const sold = Math.max(currentTicket - firstTicket, 0);
      const remaining = Math.max(quantity - sold, 0);

      return {
        id: slot.id,
        slotNumber: slot.slotNumber,
        gameName: pack.game.name,
        gameNumber: pack.game.gameNumber,
        ticketPrice: Number(pack.game.price),
        remaining,
        sold,
        quantity,
      };
    });

  const resolvedSearchParams = (await searchParams) ?? {};
  const kioskMode = resolvedSearchParams.kiosk === "1";
  const parsedInterval = Number(resolvedSearchParams.interval ?? 15);
  const refreshSeconds = Number.isFinite(parsedInterval)
    ? Math.min(Math.max(parsedInterval, 5), 120)
    : 15;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {!kioskMode && (
        <Header
          title="TV Display"
          subtitle={`${activeSlots.length} active slot${activeSlots.length === 1 ? "" : "s"} shown`}
        />
      )}
      <div className={kioskMode ? "flex-1 bg-[#050816]" : "flex-1 overflow-y-auto px-5 py-5 bg-bg"}>
        <TvDisplayBoard
          slots={activeSlots}
          kioskMode={kioskMode}
          refreshSeconds={refreshSeconds}
        />
      </div>
    </div>
  );
}
