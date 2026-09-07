import { NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";
import { getPlanAccess } from "@/lib/plan-access";
import { getResolutionMap } from "@/lib/discrepancy-resolution";

export async function GET() {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (session.role !== "OWNER") return NextResponse.json({ error: "Owner access required." }, { status: 403 });
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  try {
    const access = await getPlanAccess(session, "MULTI_STORE");
    const allStores = await prisma.store.findMany({ where: { OR: [{ ownerUserId: session.userId }, { users: { some: { id: session.userId, role: "OWNER", active: true } } }] }, select: { id: true, name: true }, orderBy: { name: "asc" } }) as Array<{ id: string; name: string }>;
    const stores = access.allowed ? allStores : allStores.slice(0, 1);
    const ids = stores.map((store) => store.id);
    const storeNames = new Map(stores.map((store) => [store.id, store.name]));
    const [locksResult, auditRows] = await Promise.all([
      prisma.pack.findMany({ where: { storeId: { in: ids }, sequenceLocked: true }, select: { id: true, storeId: true, serialNumber: true, sequenceLockedAt: true, sequenceLockExpectedTicket: true, sequenceLockScannedTicket: true, game: { select: { name: true } }, slot: { select: { slotNumber: true } } } }),
      prisma.inventoryAuditLine.findMany({ where: { audit: { storeId: { in: ids } }, variance: { not: 0 } }, select: { id: true, variance: true, endingExpectedTicket: true, endingPhysicalTicket: true, expectedTicket: true, slotNumber: true, pack: { select: { serialNumber: true, game: { select: { name: true } } } }, audit: { select: { storeId: true, endedAt: true, begunAt: true } } }, take: 300 }),
    ]);
    const locks = locksResult as Array<{ id: string; storeId: string; serialNumber: string; sequenceLockedAt: Date | null; sequenceLockExpectedTicket: number | null; sequenceLockScannedTicket: number | null; game: { name: string }; slot: { slotNumber: string } | null }>;
    const resolutionsByStore = new Map<string, Awaited<ReturnType<typeof getResolutionMap>>>();
    await Promise.all(ids.map(async (id) => resolutionsByStore.set(id, await getResolutionMap(id))));
    const exceptions = [
      ...locks.map((lock) => ({ id: lock.id, type: "SEQUENCE_LOCK", store: storeNames.get(lock.storeId) ?? "Unknown store", game: lock.game.name, pack: lock.serialNumber, display: lock.slot?.slotNumber ?? "Unassigned", expected: lock.sequenceLockExpectedTicket, observed: lock.sequenceLockScannedTicket, timestamp: lock.sequenceLockedAt, status: resolutionsByStore.get(lock.storeId)?.has(`SEQUENCE_LOCK:${lock.id}`) ? "RESOLVED" : "UNRESOLVED" })),
      ...auditRows.map((row: { id: string; variance: number | null; endingExpectedTicket: number | null; endingPhysicalTicket: number | null; expectedTicket: number; slotNumber: string; pack: { serialNumber: string; game: { name: string } }; audit: { storeId: string; endedAt: Date | null; begunAt: Date } }) => ({ id: row.id, type: "INVENTORY_AUDIT", store: storeNames.get(row.audit.storeId) ?? "Unknown store", game: row.pack.game.name, pack: row.pack.serialNumber, display: row.slotNumber, expected: row.endingExpectedTicket ?? row.expectedTicket, observed: row.endingPhysicalTicket, timestamp: row.audit.endedAt ?? row.audit.begunAt, status: resolutionsByStore.get(row.audit.storeId)?.has(`INVENTORY_AUDIT:${row.id}`) ? "RESOLVED" : "UNRESOLVED" })),
    ].sort((a, b) => new Date(b.timestamp ?? 0).getTime() - new Date(a.timestamp ?? 0).getTime());
    return NextResponse.json({ multiStoreEnabled: access.allowed, exceptions });
  } catch (error) {
    console.error("[GET /api/owner/exceptions]", error);
    return NextResponse.json({ error: "Unable to load company exceptions." }, { status: 500 });
  }
}
