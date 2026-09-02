import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getApiSession } from "@/lib/api-session";

function isPlatformAdmin(role: string) {
  return role === "PLATFORM_ADMIN";
}

export async function GET() {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!isPlatformAdmin(session.role)) return NextResponse.json({ error: "Platform admin access required." }, { status: 403 });
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  try {
    const [stores, users, owners, managers, packs, openShifts, subscriptions, recentUsers] = await Promise.all([
      prisma.store.count(),
      prisma.user.count(),
      prisma.user.count({ where: { role: "OWNER" } }),
      prisma.user.count({ where: { role: "MANAGER" } }),
      prisma.pack.count(),
      prisma.shift.count({ where: { status: "OPEN" } }),
      prisma.subscription.count(),
      prisma.user.findMany({
        where: { role: { not: "PLATFORM_ADMIN" } },
        select: { id: true, name: true, email: true, role: true, active: true, createdAt: true, store: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 12,
      }),
    ]);

    return NextResponse.json({
      metrics: { stores, users, owners, managers, packs, openShifts, subscriptions },
      recentUsers,
    });
  } catch (error) {
    console.error("[GET /api/platform/overview]", error);
    return NextResponse.json({ error: "Unable to load platform overview." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!isPlatformAdmin(session.role)) return NextResponse.json({ error: "Platform admin access required." }, { status: 403 });
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const ownerName = typeof body.ownerName === "string" ? body.ownerName.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const storeName = typeof body.storeName === "string" ? body.storeName.trim() : "";
  if (!ownerName || !email || !password || !storeName) {
    return NextResponse.json({ error: "Owner name, email, password, and store name are required." }, { status: 400 });
  }
  if (password.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });

  try {
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const store = await tx.store.create({ data: { name: storeName, timezone: "America/Chicago" } });
      const owner = await tx.user.create({
        data: { storeId: store.id, name: ownerName, email, passwordHash, role: "OWNER", active: true },
        select: { id: true, name: true, email: true, role: true },
      });
      await tx.store.update({ where: { id: store.id }, data: { ownerUserId: owner.id } });
      return { store, owner };
    });

    return NextResponse.json({ success: true, account: { owner: result.owner, store: result.store } }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/platform/overview]", error);
    return NextResponse.json({ error: "Unable to create customer account." }, { status: 500 });
  }
}
