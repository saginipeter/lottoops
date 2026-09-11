import { getSession } from "@/lib/get-session";
import { prisma } from "@/lib/prisma";
import { TvDisplayBoard } from "@/components/settings/tv-display-board";
import { getPlanAccess } from "@/lib/plan-access";
import { calculateTicketProgress } from "@/lib/tv-display";

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

  const displayAccess = session.role === "OWNER" || session.role === "MANAGER"
    ? await getPlanAccess(session, "LIVE_DISPLAY")
    : { allowed: true };
  if (!displayAccess.allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050816] p-6">
        <div className="max-w-lg rounded-lg border border-amber-300 bg-amber-50 p-6 text-center">
          <h2 className="text-lg font-semibold text-amber-900">Live Display is not enabled</h2>
          <p className="mt-2 text-sm text-amber-800">Upgrade to the Multi-Store plan to use the customer-facing display.</p>
          <a href="/billing" className="mt-4 inline-flex rounded-md bg-accent px-4 py-2 text-sm font-medium text-white">View Plans</a>
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

  const typedSlots = slots as Array<{
    id: string;
    slotNumber: string;
    pack: {
      status: string;
      ticketQuantity: number | null;
      firstTicket: number | null;
      currentTicketNumber: number | null;
      packImage: string | null;
      game: { name: string; gameNumber: string; price: unknown };
    } | null;
  }>;
  const activeSlots = typedSlots.flatMap((slot) => {
      if (!slot.pack || slot.pack.status !== "ACTIVE") return [];
      const pack = slot.pack;
      const quantity = pack.ticketQuantity ?? 0;
      const firstTicket = pack.firstTicket ?? 0;
      const currentTicket = pack.currentTicketNumber ?? firstTicket;
      const { sold, remaining } = calculateTicketProgress(firstTicket, currentTicket, quantity);

      return [{
        id: slot.id,
        slotNumber: slot.slotNumber,
        gameName: pack.game.name,
        gameNumber: pack.game.gameNumber,
        gameImage: pack.packImage ?? null,
        ticketPrice: Number(pack.game.price),
        firstTicket,
        currentTicket,
        nextTicket: Math.max(currentTicket - 1, 0),
        remaining,
        sold,
        quantity,
      }];
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
