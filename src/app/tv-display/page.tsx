import { getSession } from "@/lib/get-session";
import { prisma } from "@/lib/prisma";
import { TvDisplayBoard } from "@/components/settings/tv-display-board";
import { getPlanAccess } from "@/lib/plan-access";
import { redirect } from "next/navigation";
import {
  calculateTicketProgress,
  getDisplayRemainingTicketCount,
  getDisplayedTicketNumber,
  getNextDisplayedTicket,
} from "@/lib/tv-display";
import { verifyTvKioskToken } from "@/lib/tv-kiosk";
import { signTvKioskToken } from "@/lib/tv-kiosk";
import { parseTvScreenNumber } from "@/lib/tv-screens";

interface TvDisplayKioskPageProps {
  searchParams?: Promise<{
    interval?: string;
    token?: string;
    screen?: string;
  }>;
}

export default async function TvDisplayKioskPage({
  searchParams,
}: TvDisplayKioskPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const screenNumber = parseTvScreenNumber(resolvedSearchParams.screen);
  const kioskToken = resolvedSearchParams.token ? await verifyTvKioskToken(resolvedSearchParams.token) : null;
  const session = await getSession();

  if (!session && !kioskToken) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050816] p-6">
        <div className="rounded-lg border border-red-300 bg-red-50 p-6 text-center">
          <p className="text-red-600 font-medium">Not authenticated</p>
        </div>
      </div>
    );
  }

  const displayAccess = session && (session.role === "OWNER" || session.role === "MANAGER")
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

  const parsedInterval = Number(resolvedSearchParams.interval ?? 15);
  const refreshSeconds = Number.isFinite(parsedInterval)
    ? Math.min(Math.max(parsedInterval, 5), 120)
    : 15;

  // A staff-authenticated launch becomes a signed kiosk launch before the TV can
  // depend on the staff cookie. This keeps the customer board alive when that
  // staff member logs out or their terminal session expires.
  if (session && !kioskToken) {
    const token = await signTvKioskToken(
      { storeId: session.storeId, storeName: session.storeName },
      30 * 24 * 60 * 60,
    );
    const params = new URLSearchParams({
      token,
      kiosk: "1",
      screen: String(screenNumber),
      interval: String(refreshSeconds),
    });
    redirect(`/tv-display?${params.toString()}`);
  }

  const storeId = kioskToken?.storeId ?? session?.storeId;
  if (!storeId) return null;

  const slots = await prisma.displaySlot.findMany({
    where: { storeId },
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
      id: string;
      status: string;
      ticketQuantity: number | null;
      firstTicket: number | null;
      currentTicketNumber: number | null;
      firstOrLastTicket: string | null;
      packImage: string | null;
      game: { id: string; name: string; gameNumber: string; price: unknown; imageUrl: string | null };
    } | null;
  }>;
  const activeSlots = typedSlots.flatMap((slot) => {
      if (!slot.pack || slot.pack.status !== "ACTIVE") return [];
      const pack = slot.pack;
      const quantity = pack.ticketQuantity ?? 0;
      const firstTicket = pack.firstTicket ?? 1;
      const currentTicket = getDisplayRemainingTicketCount(
        pack.currentTicketNumber,
        firstTicket,
        quantity,
        pack.firstOrLastTicket,
      );
      const { sold, remaining } = calculateTicketProgress(firstTicket, currentTicket, quantity);
      const displayedTicket = getDisplayedTicketNumber(firstTicket, currentTicket, quantity, pack.firstOrLastTicket);

      return [{
        id: slot.id,
        packId: pack.id,
        gameId: pack.game.id,
        slotNumber: slot.slotNumber,
        gameName: pack.game.name,
        gameNumber: pack.game.gameNumber,
        gameImage: pack.game.imageUrl ?? null,
        ticketPrice: Number(pack.game.price),
        sellDirection: (pack.firstOrLastTicket === "LAST" ? "LAST" : "FIRST") as "FIRST" | "LAST",
        firstTicket,
        currentTicket: displayedTicket,
        nextTicket: getNextDisplayedTicket(firstTicket, currentTicket, quantity, pack.firstOrLastTicket),
        remaining,
        sold,
        quantity,
      }];
    });

  // eslint-disable-next-line react-hooks/purity -- Async server response metadata, stamped after the database read.
  const verifiedAt = Date.now();

  return (
    <TvDisplayBoard
      slots={activeSlots}
      kioskMode
      refreshSeconds={refreshSeconds}
      screenNumber={screenNumber}
      kioskToken={resolvedSearchParams.token}
      verifiedAt={verifiedAt}
    />
  );
}
