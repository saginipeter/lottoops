import { NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";
import { signSession, SESSION_COOKIE } from "@/lib/session";
import { logPlatformActivity } from "@/lib/platform-audit";

const BACKUP_COOKIE = "lottoops_platform_session_backup";

export async function POST(request: NextRequest) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (session.role !== "PLATFORM_ADMIN") return NextResponse.json({ error: "Platform admin access required." }, { status: 403 });
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const body = await request.json().catch(() => ({}));
  const storeId = typeof body.storeId === "string" ? body.storeId.trim() : "";
  if (!storeId) return NextResponse.json({ error: "Store ID is required." }, { status: 400 });

  const target = await prisma.user.findFirst({
    where: { storeId, role: { in: ["OWNER", "MANAGER"] }, active: true, store: { ownerUserId: { not: null } } },
    include: { store: { select: { id: true, name: true } } },
    orderBy: { role: "asc" },
  });
  if (!target) return NextResponse.json({ error: "No active Owner or Manager account exists for this store." }, { status: 404 });

  const token = await signSession({ userId: target.id, storeId: target.storeId, storeName: target.store.name, name: target.name, email: target.email, role: target.role, grantedPermissions: target.grantedPermissions ?? [], impersonatedBy: { userId: session.userId, name: session.name, email: session.email } });
  const response = NextResponse.json({ success: true, store: { id: target.store.id, name: target.store.name }, user: { name: target.name, role: target.role } });
  await logPlatformActivity({ action: "IMPERSONATION_STARTED", entityType: "STORE", entityId: target.store.id, detail: `Support session started as ${target.email}.`, performedById: session.userId, performedByName: session.name });
  response.cookies.set(BACKUP_COOKIE, await signSession(session), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 60 * 30, path: "/" });
  response.cookies.set(SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 60 * 30, path: "/" });
  return response;
}
