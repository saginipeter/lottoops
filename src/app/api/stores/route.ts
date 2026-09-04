import { NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";

const US_TIMEZONES = [
  "America/Chicago",
  "America/New_York",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
];

// GET /api/stores — OWNER sees all their stores; MANAGER sees only their own
export async function GET() {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  if (session.role === "OWNER") {
    // Owner sees all stores they created
    const stores = await prisma.store.findMany({
      where: {
        OR: [
          { ownerUserId: session.userId },
          { users: { some: { id: session.userId, role: "OWNER", active: true } } },
        ],
      },
      include: {
        users: { select: { id: true, role: true, active: true } },
        _count: { select: { packs: true, shifts: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ stores });
  }

  // Manager/Clerk/Viewer: see only their own store
  const store = await prisma.store.findUnique({
    where: { id: session.storeId },
    select: { id: true, name: true, storeNumber: true, timezone: true, address: true, phone: true, createdAt: true },
  });
  return NextResponse.json({ stores: store ? [store] : [] });
}

// POST /api/stores — OWNER creates a new store
export async function POST(req: NextRequest) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (session.role !== "OWNER") {
    return NextResponse.json({ error: "Only owners can create stores." }, { status: 403 });
  }
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const { name, storeNumber, timezone, address, phone } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Store name is required." }, { status: 400 });
  }
  if (!storeNumber?.trim()) {
    return NextResponse.json({ error: "Store number is required." }, { status: 400 });
  }

  const tz = timezone && US_TIMEZONES.includes(timezone) ? timezone : "America/Chicago";

  const store = await prisma.store.create({
    data: {
      name: name.trim(),
      storeNumber: storeNumber.trim(),
      timezone: tz,
      address: address?.trim() ?? null,
      phone: phone?.trim() ?? null,
      ownerUserId: session.userId,
    },
  });

  return NextResponse.json({
    store: {
      ...store,
      users: [],
      _count: { packs: 0, shifts: 0 },
    },
  }, { status: 201 });
}
