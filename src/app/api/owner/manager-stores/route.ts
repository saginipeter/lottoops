import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiSession } from "@/lib/api-session";

let schemaReady = false;

async function ensureSchema() {
  if (schemaReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS manager_store_assignments (
      manager_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
      assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (manager_id, store_id)
    )
  `);
  schemaReady = true;
}

function ownerOnly(role: string) {
  return role === "OWNER";
}

export async function GET() {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!ownerOnly(session.role)) return NextResponse.json({ error: "Owner access required." }, { status: 403 });
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  try {
    await ensureSchema();
    const stores = await prisma.store.findMany({
      where: { ownerUserId: session.userId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    const storeIds = stores.map((store: { id: string; name: string }) => store.id);
    const managers = await prisma.user.findMany({
      where: { role: "MANAGER", storeId: { in: storeIds } },
      select: { id: true, name: true, email: true, storeId: true },
      orderBy: { name: "asc" },
    });
    const assignments = storeIds.length === 0
      ? []
      : await prisma.$queryRawUnsafe(
          `
          SELECT manager_id AS "managerId", store_id AS "storeId"
          FROM manager_store_assignments
          WHERE store_id = ANY($1::text[])
          `,
          storeIds
        );

    return NextResponse.json({ stores, managers, assignments });
  } catch (error) {
    console.error("[GET /api/owner/manager-stores]", error);
    return NextResponse.json({ error: "Unable to load manager assignments." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!ownerOnly(session.role)) return NextResponse.json({ error: "Owner access required." }, { status: 403 });
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const managerId = typeof body.managerId === "string" ? body.managerId.trim() : "";
  const storeId = typeof body.storeId === "string" ? body.storeId.trim() : "";
  const action = body.action === "remove" ? "remove" : "assign";

  if (!managerId || !storeId) {
    return NextResponse.json({ error: "managerId and storeId are required." }, { status: 400 });
  }

  try {
    await ensureSchema();
    const store = await prisma.store.findFirst({
      where: { id: storeId, ownerUserId: session.userId },
      select: { id: true },
    });
    if (!store) return NextResponse.json({ error: "Store not found in your portfolio." }, { status: 404 });

    const manager = await prisma.user.findFirst({
      where: { id: managerId, role: "MANAGER", store: { ownerUserId: session.userId } },
      select: { id: true },
    });
    if (!manager) return NextResponse.json({ error: "Manager not found in your portfolio." }, { status: 404 });

    if (action === "remove") {
      await prisma.$executeRawUnsafe(
        `DELETE FROM manager_store_assignments WHERE manager_id = $1 AND store_id = $2`,
        managerId,
        storeId
      );
    } else {
      await prisma.$executeRawUnsafe(
        `
        INSERT INTO manager_store_assignments (manager_id, store_id)
        VALUES ($1, $2)
        ON CONFLICT (manager_id, store_id) DO NOTHING
        `,
        managerId,
        storeId
      );
    }

    return NextResponse.json({ success: true, action, managerId, storeId });
  } catch (error) {
    console.error("[POST /api/owner/manager-stores]", error);
    return NextResponse.json({ error: "Unable to update manager assignment." }, { status: 500 });
  }
}
