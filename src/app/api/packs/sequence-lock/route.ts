import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiSession } from "@/lib/api-session";
import { isManagerOrAbove } from "@/lib/permissions";
import { logInventoryActivity } from "@/lib/activity-log";

export async function GET() {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!isManagerOrAbove(session)) return NextResponse.json({ error: "Manager access required." }, { status: 403 });
  const packs = await prisma.pack.findMany({
    where: { storeId: session.storeId, sequenceLocked: true },
    include: { game: true, slot: true },
    orderBy: { sequenceLockedAt: "asc" },
  });
  return NextResponse.json(packs);
}

export async function POST(request: NextRequest) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!isManagerOrAbove(session)) return NextResponse.json({ error: "Manager access required." }, { status: 403 });
  const { packId, reason } = await request.json().catch(() => ({}));
  if (!packId || !reason?.trim()) return NextResponse.json({ error: "Pack and resolution reason are required." }, { status: 400 });
  const pack = await prisma.pack.findFirst({ where: { id: packId, storeId: session.storeId, sequenceLocked: true } });
  if (!pack) return NextResponse.json({ error: "Locked pack not found." }, { status: 404 });
  await prisma.pack.update({ where: { id: pack.id }, data: { sequenceLocked: false, sequenceLockExpectedTicket: null, sequenceLockScannedTicket: null, sequenceLockBarcode: null, sequenceLockedAt: null, sequenceLockedById: null } });
  await logInventoryActivity({ storeId: session.storeId, action: "SEQUENCE_LOCK_RESOLVED", entityType: "PACK", entityId: pack.id, detail: `Resolved sequence lock. Expected ${pack.sequenceLockExpectedTicket}, scanned ${pack.sequenceLockScannedTicket}. Reason: ${reason.trim()}`, performedById: session.userId, performedByName: session.name });
  return NextResponse.json({ success: true });
}