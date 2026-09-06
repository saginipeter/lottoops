import { NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";
import { revokeUserSessions } from "@/lib/session-revocation";

function platformOnly(role: string) { return role === "PLATFORM_ADMIN"; }

export async function GET() {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!platformOnly(session.role)) return NextResponse.json({ error: "Platform admin access required." }, { status: 403 });
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const users = await prisma.user.findMany({ where: { role: { not: "PLATFORM_ADMIN" } }, select: { id: true, name: true, email: true, role: true, active: true, lastLoginAt: true, store: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" }, take: 250 });
  return NextResponse.json({ users });
}

export async function PATCH(request: NextRequest) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!platformOnly(session.role)) return NextResponse.json({ error: "Platform admin access required." }, { status: 403 });
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const body = await request.json().catch(() => ({}));
  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  if (!userId) return NextResponse.json({ error: "User ID is required." }, { status: 400 });
  const user = await prisma.user.findFirst({ where: { id: userId, role: { not: "PLATFORM_ADMIN" } }, select: { id: true, active: true } });
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });
  if (body.revokeSessions === true) {
    await revokeUserSessions(userId);
    return NextResponse.json({ success: true, revoked: true });
  }
  if (typeof body.active !== "boolean") return NextResponse.json({ error: "Active status is required." }, { status: 400 });
  await prisma.user.update({ where: { id: userId }, data: { active: body.active } });
  if (!body.active) await revokeUserSessions(userId);
  return NextResponse.json({ success: true, active: body.active });
}
