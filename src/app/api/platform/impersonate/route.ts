import { NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";
import { signSession, SESSION_COOKIE } from "@/lib/session";
import { logPlatformActivity } from "@/lib/platform-audit";
import { consumeSupportAccess, isSameOriginMutation, SupportAccessError } from "@/lib/support-access";

const BACKUP_COOKIE = "lottoops_platform_session_backup";

export async function POST(request: NextRequest) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Same-origin request required." }, { status: 403 });
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (session.role !== "PLATFORM_ADMIN") return NextResponse.json({ error: "Platform admin access required." }, { status: 403 });
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const body = await request.json().catch(() => ({}));
  let access;
  try {
    access = await consumeSupportAccess(session, body?.token);
  } catch (error) {
    return NextResponse.json({ error: error instanceof SupportAccessError ? error.message : "Unable to redeem support link." }, { status: error instanceof SupportAccessError ? 403 : 500 });
  }
  const target = await prisma.user.findUnique({ where: { id: access.ownerUserId } });
  const store = await prisma.store.findUnique({ where: { id: access.storeId } });
  if (!target || !store) return NextResponse.json({ error: "Store owner unavailable." }, { status: 403 });
  const supportSession = { userId: target.id, storeId: store.id, storeName: store.name, name: target.name, email: target.email, role: "MANAGER" as const, grantedPermissions: [], supportAccessId: access.id, impersonatedBy: { userId: session.userId, name: session.name, email: session.email } };
  const token = await signSession(supportSession);
  const response = NextResponse.json({ success: true, store: { id: store.id, name: store.name }, user: { name: target.name, role: supportSession.role } });
  await logPlatformActivity({ action: "SUPPORT_ACCESS_REDEEMED", entityType: "STORE", entityId: store.id, detail: `Owner-approved support session started for request ${access.id}.`, performedById: session.userId, performedByName: session.name });
  response.cookies.set(BACKUP_COOKIE, await signSession(session), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 60 * 30, path: "/" });
  response.cookies.set(SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 60 * 30, path: "/" });
  return response;
}
