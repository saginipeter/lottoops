import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiSession } from "@/lib/api-session";

interface OwnerStore {
  id: string;
  name: string;
  timezone: string;
  address: string | null;
  phone: string | null;
  createdAt: Date;
  users: Array<{ id: string; role: string; active: boolean }>;
}

interface OwnerPack {
  storeId: string;
  status: string;
  sequenceLocked: boolean;
}

interface OwnerLine {
  shift: { storeId: string };
  ticketsSold: number | null;
  salesAmount: unknown;
}

export async function GET() {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (session.role !== "OWNER") return NextResponse.json({ error: "Owner access required." }, { status: 403 });
  if (!prisma) return NextResponse.json({ error: "Database not connected" }, { status: 503 });

  try {
    const stores = (await prisma.store.findMany({
      where: { ownerUserId: session.userId },
      include: { users: { select: { id: true, role: true, active: true } } },
      orderBy: { name: "asc" },
    })) as OwnerStore[];
    const storeIds = stores.map((store) => store.id);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [packs, openShifts, todayLines, rawShiftsToday] = await Promise.all([
      prisma.pack.findMany({ where: { storeId: { in: storeIds } }, select: { storeId: true, status: true, sequenceLocked: true } }),
      prisma.shift.findMany({ where: { storeId: { in: storeIds }, status: "OPEN" }, select: { storeId: true } }),
      prisma.shiftLine.findMany({ where: { shift: { AND: [{ storeId: { in: storeIds } }, { openedAt: { gte: today } }] } }, select: { shift: { select: { storeId: true } }, ticketsSold: true, salesAmount: true } }),
      prisma.shift.findMany({ where: { storeId: { in: storeIds }, openedAt: { gte: today } }, select: { id: true, storeId: true } }),
    ]);
    const shiftsToday = rawShiftsToday as Array<{ id: string; storeId: string }>;
    const ownerPacks = packs as OwnerPack[];
    const ownerLines = todayLines as OwnerLine[];

    let completedAudits = 0;
    try {
      completedAudits = await prisma.inventoryAudit.count({ where: { storeId: { in: storeIds }, status: "COMPLETED", shiftId: { in: shiftsToday.map((shift) => shift.id) } } });
    } catch {
      completedAudits = 0;
    }

    const storeRows = stores.map((store) => {
      const storePacks = ownerPacks.filter((pack) => pack.storeId === store.id);
      const storeLines = ownerLines.filter((line) => line.shift.storeId === store.id);
      return {
        id: store.id,
        name: store.name,
        timezone: store.timezone,
        address: store.address,
        phone: store.phone,
        createdAt: store.createdAt,
        users: store.users,
        _count: { packs: storePacks.length, shifts: shiftsToday.filter((shift) => shift.storeId === store.id).length },
        salesToday: storeLines.reduce((sum, line) => sum + Number(line.salesAmount ?? 0), 0),
        ticketsToday: storeLines.reduce((sum, line) => sum + Number(line.ticketsSold ?? 0), 0),
        openShift: openShifts.some((shift) => shift.storeId === store.id),
        backstock: storePacks.filter((pack) => pack.status === "BACK_STOCK").length,
        activePacks: storePacks.filter((pack) => pack.status === "ACTIVE").length,
        lockedPacks: storePacks.filter((pack) => pack.sequenceLocked).length,
      };
    });

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      stores: storeRows,
      summary: {
        salesToday: storeRows.reduce((sum, store) => sum + store.salesToday, 0),
        ticketsToday: storeRows.reduce((sum, store) => sum + store.ticketsToday, 0),
        activePacks: storeRows.reduce((sum, store) => sum + store.activePacks, 0),
        backstockPacks: storeRows.reduce((sum, store) => sum + store.backstock, 0),
        lockedPacks: storeRows.reduce((sum, store) => sum + store.lockedPacks, 0),
        openShifts: openShifts.length,
        auditCompletionRate: shiftsToday.length ? Math.round((completedAudits / shiftsToday.length) * 100) : 0,
      },
    });
  } catch (error) {
    console.error("[GET /api/owner/overview]", error);
    return NextResponse.json({ error: "Unable to load owner overview." }, { status: 500 });
  }
}
