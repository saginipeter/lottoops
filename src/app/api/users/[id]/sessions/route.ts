import { NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";
import { revokeUserSessions } from "@/lib/session-revocation";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (session.role !== "MANAGER" && session.role !== "OWNER") return NextResponse.json({ error: "Manager access required." }, { status: 403 });
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const { id } = await params;
  const target = await prisma.user.findFirst({
    where: session.role === "OWNER"
      ? { id, store: { OR: [{ ownerUserId: session.userId }, { users: { some: { id: session.userId, role: "OWNER", active: true } } }] } }
      : { id, storeId: session.storeId },
    select: { id: true },
  });
  if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });
  await revokeUserSessions(id);
  return NextResponse.json({ success: true });
}
