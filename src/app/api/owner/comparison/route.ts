import { NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";
import { getPlanAccess } from "@/lib/plan-access";

interface StoreRow { id: string; name: string; storeNumber: string | null }
interface PackRow { storeId: string; status: string; sequenceLocked: boolean }
interface ShiftRow { storeId: string; status: string; lines: Array<{ ticketsSold: number | null; salesAmount: unknown }> }

export async function GET(request: NextRequest) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (session.role !== "OWNER") return NextResponse.json({ error: "Owner access required." }, { status: 403 });
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const access = await getPlanAccess(session, "MULTI_STORE");
  const today = new Date();
  const to = request.nextUrl.searchParams.get("to") ? new Date(`${request.nextUrl.searchParams.get("to")}T23:59:59`) : today;
  const from = request.nextUrl.searchParams.get("from") ? new Date(`${request.nextUrl.searchParams.get("from")}T00:00:00`) : new Date(to.getTime() - 30 * 86400000);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) return NextResponse.json({ error: "Invalid comparison date range." }, { status: 400 });

  try {
    const allStores = await prisma.store.findMany({
      where: { OR: [{ ownerUserId: session.userId }, { users: { some: { id: session.userId, role: "OWNER", active: true } } }] },
      select: { id: true, name: true, storeNumber: true },
      orderBy: { name: "asc" },
    }) as StoreRow[];
    const stores = access.allowed ? allStores : allStores.slice(0, 1);
    const ids = stores.map((store) => store.id);
    const [packsResult, shiftsResult] = await Promise.all([
      prisma.pack.findMany({ where: { storeId: { in: ids } }, select: { storeId: true, status: true, sequenceLocked: true } }),
      prisma.shift.findMany({ where: { storeId: { in: ids }, OR: [{ status: "OPEN" }, { closedAt: { gte: from, lte: to } }] }, select: { storeId: true, status: true, closedAt: true, lines: { select: { ticketsSold: true, salesAmount: true } } } }),
    ]);
    const packs = packsResult as PackRow[];
    const shifts = shiftsResult as ShiftRow[];

    const rows = stores.map((store) => {
      const storePacks = packs.filter((pack) => pack.storeId === store.id);
      const storeShifts = shifts.filter((shift) => shift.storeId === store.id);
      return {
        id: store.id,
        name: store.name,
        storeNumber: store.storeNumber,
        sales: Math.round(storeShifts.reduce((sum, shift) => sum + shift.lines.reduce((lineSum, line) => lineSum + Number(line.salesAmount ?? 0), 0), 0) * 100) / 100,
        tickets: storeShifts.reduce((sum, shift) => sum + shift.lines.reduce((lineSum, line) => lineSum + Number(line.ticketsSold ?? 0), 0), 0),
        activePacks: storePacks.filter((pack) => pack.status === "ACTIVE").length,
        backstockPacks: storePacks.filter((pack) => pack.status === "BACK_STOCK").length,
        lockedPacks: storePacks.filter((pack) => pack.sequenceLocked).length,
        openShifts: storeShifts.filter((shift) => shift.status === "OPEN").length,
      };
    });
    if (request.nextUrl.searchParams.get("format") === "csv") {
      const escape = (value: unknown) => {
        const text = String(value ?? "");
        return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
      };
      const csvRows = [
        ["Store", "Store Number", "Sales", "Tickets", "Active Packs", "Backstock Packs", "Locked Packs", "Open Shifts"],
        ...rows.map((row) => [row.name, row.storeNumber ?? "", row.sales, row.tickets, row.activePacks, row.backstockPacks, row.lockedPacks, row.openShifts]),
      ];
      const csv = csvRows.map((row) => row.map(escape).join(",")).join("\r\n");
      return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="store-comparison-${from.toISOString().slice(0, 10)}-${to.toISOString().slice(0, 10)}.csv"` } });
    }
    return NextResponse.json({ from: from.toISOString(), to: to.toISOString(), multiStoreEnabled: access.allowed, stores: rows });
  } catch (error) {
    console.error("[GET /api/owner/comparison]", error);
    return NextResponse.json({ error: "Unable to load store comparison." }, { status: 500 });
  }
}
