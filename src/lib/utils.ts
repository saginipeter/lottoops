import { games, packs } from "./mock-data";

import { Game, Pack, DisplaySlot } from "./types";

export function getGame(gameId: string): Game | undefined {
  return games.find((g) => g.id === gameId);
}



export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

export function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHrs < 1) return "Just now";
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  return `${diffDays}d ago`;
}

export function getBackStockPacks(): Pack[] {
  return packs.filter((p) => p.status === "back-stock");
}

export function getActivePacks(): Pack[] {
  return packs.filter((p) => p.status === "active");
}



export function getSlotNumber(pack: Pack): string {
  if (!pack.slotId) return "—";
  const n = pack.slotId.replace("slot-", "");
  return n.padStart(2, "0");
}

export function getTicketProgress(pack: Pack): number {
  const game = getGame(pack.gameId);
  if (!game || pack.currentTicketNumber === undefined) return 0;
  const sold = game.ticketsPerPack - pack.currentTicketNumber;
  return Math.round((sold / game.ticketsPerPack) * 100);
}

export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function getDashboardStats() {
  const backStock = getBackStockPacks();
  const active = getActivePacks();
  const soldOut = packs.filter((p) => p.status === "sold-out");
  const backStockValue = backStock.reduce((sum, p) => sum + p.retailValue, 0);

  return {
    backStockCount: backStock.length,
    activeCount: active.length,
    soldOutCount: soldOut.length,
    backStockValue,
  };
}





// ... existing functions stay as they are ...

export function getDisplaySlots(): Pack[] {
  // Active and sold-out packs, sorted by slot number, for the slots table.
  return packs
    .filter((p) => p.status === "active" || p.status === "sold-out")
    .sort((a, b) => (a.slotId ?? "").localeCompare(b.slotId ?? ""));
}

// Total physical slots on the TV display board. In the real app this would
// be a store-level setting; hardcoded here since there's no Settings
// persistence yet.
export const TOTAL_DISPLAY_SLOTS = 10;

export function getDisplayBoard(): DisplaySlot[] {
  // The full physical board — every slot from 1 to TOTAL_DISPLAY_SLOTS,
  // each either empty or carrying the pack currently assigned to it.
  // This is what the Display Slots management page renders, as opposed
  // to getDisplaySlots() above, which only lists occupied slots for the
  // dashboard's compact table.
  const board: DisplaySlot[] = [];
  for (let i = 1; i <= TOTAL_DISPLAY_SLOTS; i++) {
    const slotId = `slot-${i}`;
    const pack = packs.find((p) => p.slotId === slotId) ?? null;
    board.push({ slotNumber: String(i).padStart(2, "0"), pack});
  }
  return board;
}