import { getSession } from "@/lib/get-session";
import { prisma } from "@/lib/prisma";
import { TvDisplayBoard } from "@/components/settings/tv-display-board";

interface TvDisplayKioskPageProps {
  searchParams?: Promise<{
    interval?: string;
  }>;
}

export default async function TvDisplayKioskPage({
  searchParams,
}: TvDisplayKioskPageProps) {
  const session = await getSession();

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050816] p-6">
        <div className="rounded-lg border border-red-300 bg-red-50 p-6 text-center">
          <p className="text-red-600 font-medium">Not authenticated</p>
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
        gameImage: pack.packImage ?? null,
        ticketPrice: Number(pack.game.price),
        remaining,
        sold,
        quantity,
      };
    });

  const resolvedSearchParams = (await searchParams) ?? {};
  const parsedInterval = Number(resolvedSearchParams.interval ?? 15);
  const refreshSeconds = Number.isFinite(parsedInterval)
    ? Math.min(Math.max(parsedInterval, 5), 120)
    : 15;

  return (
    <TvDisplayBoard
      slots={activeSlots}
      kioskMode
      refreshSeconds={refreshSeconds}
    />
  );
}
