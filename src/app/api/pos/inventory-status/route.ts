import { NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";
import { getRemainingTicketCount } from "@/lib/tv-display";

const LOW_STOCK_THRESHOLD = 5;
type ActivePackRow = { id: string; serialNumber: string; currentTicketNumber: number | null; ticketQuantity: number | null; firstOrLastTicket: string | null; ticketPrice: unknown; game: { name: string; gameNumber: string; ticketsPerPack: number; price: unknown }; slot: { id: string; slotNumber: string } | null };
type DisplaySlotRow = { id: string; slotNumber: string; packId: string | null };

export async function GET() {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (session.role === "AUDITOR") return NextResponse.json({ error: "Auditor accounts cannot access operational inventory status." }, { status: 403 });
  if (!prisma) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  try {
    const [packsResult, slotsResult] = await Promise.all([
      prisma.pack.findMany({ where: { storeId: session.storeId, status: "ACTIVE" }, select: { id: true, serialNumber: true, currentTicketNumber: true, ticketQuantity: true, firstOrLastTicket: true, ticketPrice: true, game: { select: { name: true, gameNumber: true, ticketsPerPack: true, price: true } }, slot: { select: { id: true, slotNumber: true } } } }),
      prisma.displaySlot.findMany({ where: { storeId: session.storeId }, select: { id: true, slotNumber: true, packId: true }, orderBy: { slotNumber: "asc" } }),
    ]);
    const packs = packsResult as unknown as ActivePackRow[];
    const slots = slotsResult as unknown as DisplaySlotRow[];
    const activePacks = packs.map((pack) => {
      const quantity = Number(pack.ticketQuantity ?? pack.game.ticketsPerPack ?? 0);
      const remaining = getRemainingTicketCount(pack.currentTicketNumber, quantity);
      return { id: pack.id, serial: pack.serialNumber, game: pack.game.name, gameNumber: pack.game.gameNumber, slotNumber: pack.slot?.slotNumber ?? null, remaining, quantity, price: Number(pack.ticketPrice ?? pack.game.price ?? 0), status: remaining === 0 ? "SOLD_OUT" : remaining <= LOW_STOCK_THRESHOLD ? "LOW" : "HEALTHY", direction: pack.firstOrLastTicket === "LAST" ? "LAST" : "FIRST" };
    });
    const alerts = activePacks.filter((pack) => pack.status !== "HEALTHY").map((pack) => ({ id: `STOCK_${pack.id}`, severity: pack.status === "SOLD_OUT" ? "URGENT" : "HIGH", title: pack.status === "SOLD_OUT" ? "Display sold out" : "Low tickets remaining", detail: `${pack.game} at Display ${pack.slotNumber ?? "-"} has ${pack.remaining} ticket(s) remaining.`, packId: pack.id, slotNumber: pack.slotNumber, remaining: pack.remaining }));
    return NextResponse.json({ updatedAt: new Date().toISOString(), lowStockThreshold: LOW_STOCK_THRESHOLD, packs: activePacks, slots: slots.map((slot) => ({ id: slot.id, slotNumber: slot.slotNumber, packId: slot.packId })), alerts });
  } catch (error) {
    console.error("[GET /api/pos/inventory-status]", error);
    return NextResponse.json({ error: "Unable to load live inventory status." }, { status: 500 });
  }
}
