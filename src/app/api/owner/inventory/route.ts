import { NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";
import { getPlanAccess } from "@/lib/plan-access";

export async function GET(request: NextRequest) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (session.role !== "OWNER") return NextResponse.json({ error: "Owner access required." }, { status: 403 });
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  try {
    const access = await getPlanAccess(session, "MULTI_STORE");
    const allStores = await prisma.store.findMany({ where: { OR: [{ ownerUserId: session.userId }, { users: { some: { id: session.userId, role: "OWNER", active: true } } }] }, select: { id: true, name: true }, orderBy: { name: "asc" } }) as Array<{ id: string; name: string }>;
    const stores = access.allowed ? allStores : allStores.slice(0, 1);
    const storeNames = new Map(stores.map((store) => [store.id, store.name]));
    const status = request.nextUrl.searchParams.get("status")?.trim();
    const agingDays = Number(request.nextUrl.searchParams.get("agingDays") ?? "0");
    const packs = await prisma.pack.findMany({ where: { storeId: { in: stores.map((store) => store.id) }, ...(status ? { status } : {}) }, select: { id: true, storeId: true, serialNumber: true, status: true, receivedAt: true, activatedAt: true, currentTicketNumber: true, ticketQuantity: true, retailValue: true, game: { select: { gameNumber: true, name: true, price: true } }, slot: { select: { slotNumber: true } } }, orderBy: { receivedAt: "desc" }, take: 1000 }) as Array<{ id: string; storeId: string; serialNumber: string; status: string; receivedAt: Date; activatedAt: Date | null; currentTicketNumber: number | null; ticketQuantity: number | null; retailValue: unknown; game: { gameNumber: string; name: string; price: unknown }; slot: { slotNumber: string } | null }>;
    const now = Date.now();
    const rows = packs.map((pack) => ({ store: storeNames.get(pack.storeId) ?? "Unknown store", gameNumber: pack.game.gameNumber, game: pack.game.name, serialNumber: pack.serialNumber, status: pack.status, display: pack.slot?.slotNumber ?? "", receivedAt: pack.receivedAt, activatedAt: pack.activatedAt, currentTicket: pack.currentTicketNumber, quantity: pack.ticketQuantity, price: Number(pack.game.price), estimatedValue: Number(pack.retailValue ?? 0), ageDays: Math.floor((now - pack.receivedAt.getTime()) / 86400000) })).filter((pack) => !Number.isFinite(agingDays) || agingDays <= 0 || pack.ageDays >= agingDays);
    if (request.nextUrl.searchParams.get("format") === "csv") {
      const escape = (value: unknown) => { const text = String(value ?? ""); return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; };
      const csv = [["Store", "Game #", "Game", "Pack", "Status", "Display", "Received", "Activated", "Age Days", "Estimated Value", "Current Ticket", "Quantity", "Price"], ...rows.map((row) => [row.store, row.gameNumber, row.game, row.serialNumber, row.status, row.display, row.receivedAt, row.activatedAt ?? "", row.ageDays, row.estimatedValue, row.currentTicket ?? "", row.quantity ?? "", row.price])].map((row) => row.map(escape).join(",")).join("\r\n");
      return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=company-inventory.csv" } });
    }
    return NextResponse.json({ multiStoreEnabled: access.allowed, packs: rows });
  } catch (error) {
    console.error("[GET /api/owner/inventory]", error);
    return NextResponse.json({ error: "Unable to load company inventory." }, { status: 500 });
  }
}
