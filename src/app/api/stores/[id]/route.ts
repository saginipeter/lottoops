import { NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";

// PATCH /api/stores/[id] — update store details (OWNER of that store)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const { id } = await params;

  // OWNER can only edit stores they own; MANAGER can only edit their own store
  if (session.role === "OWNER") {
    const store = await prisma.store.findFirst({
      where: { id, ownerUserId: session.userId },
      select: { id: true },
    });
    if (!store) return NextResponse.json({ error: "Store not found." }, { status: 404 });
  } else if (session.role === "MANAGER") {
    if (id !== session.storeId) {
      return NextResponse.json({ error: "You can only edit your own store." }, { status: 403 });
    }
  } else {
    return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { name, timezone, address, phone } = body;

  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = String(name).trim();
  if (timezone !== undefined) data.timezone = timezone;
  if (address !== undefined) data.address = address?.trim() ?? null;
  if (phone !== undefined) data.phone = phone?.trim() ?? null;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update." }, { status: 400 });
  }

  const updated = await prisma.store.update({ where: { id }, data });
  return NextResponse.json({ store: updated });
}
