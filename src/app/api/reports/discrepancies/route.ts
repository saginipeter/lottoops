import { NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-session";
import { canAccessReports } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getResolutionMap } from "@/lib/discrepancy-resolution";

interface LockedPackReport {
  id: string;
  serialNumber: string;
  game: { name: string };
  slot: { slotNumber: string } | null;
  sequenceLockExpectedTicket: number | null;
  sequenceLockScannedTicket: number | null;
  sequenceLockedAt: Date | null;
}

interface AuditVarianceReport {
  id: string;
  slotNumber: string;
  expectedTicket: number;
  endingExpectedTicket: number | null;
  beginningPhysicalTicket: number | null;
  endingPhysicalTicket: number | null;
  variance: number | null;
  varianceReason: string | null;
  pack: { serialNumber: string; game: { name: string } };
  audit: {
    status: string;
    begunAt: Date;
    endedAt: Date | null;
    begunBy: { name: string };
    endedBy: { name: string } | null;
  };
}

export async function GET() {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!canAccessReports(session)) return NextResponse.json({ error: "Reports access required." }, { status: 403 });
  if (!prisma) return NextResponse.json({ error: "Database not connected" }, { status: 503 });

  try {
    const lockedPacks = await prisma.pack.findMany({
      where: { storeId: session.storeId, sequenceLocked: true },
      include: { game: { select: { name: true } }, slot: { select: { slotNumber: true } } },
      orderBy: { sequenceLockedAt: "asc" },
    });
    const auditLines = (await prisma.inventoryAuditLine.findMany({
      where: { audit: { storeId: session.storeId }, variance: { not: 0 } },
      include: { pack: { select: { serialNumber: true, game: { select: { name: true } } } }, audit: { select: { status: true, begunAt: true, endedAt: true, begunBy: { select: { name: true } }, endedBy: { select: { name: true } } } } },
      orderBy: { id: "desc" },
    })) as AuditVarianceReport[];
    const lockReports = lockedPacks as LockedPackReport[];
    const resolutions = await getResolutionMap(session.storeId);

    return NextResponse.json({
      unresolved: lockReports.map((pack) => ({
        id: pack.id,
        type: "SEQUENCE_LOCK",
        status: resolutions.has(`SEQUENCE_LOCK:${pack.id}`) ? "RESOLVED" : "UNRESOLVED",
        game: pack.game.name,
        pack: pack.serialNumber,
        display: pack.slot?.slotNumber ?? "Unassigned",
        expected: pack.sequenceLockExpectedTicket,
        observed: pack.sequenceLockScannedTicket,
        variance: pack.sequenceLockScannedTicket !== null && pack.sequenceLockExpectedTicket !== null
          ? pack.sequenceLockScannedTicket - pack.sequenceLockExpectedTicket
          : null,
        timestamp: pack.sequenceLockedAt,
        actor: "Live scan",
        reason: resolutions.get(`SEQUENCE_LOCK:${pack.id}`)?.reason ?? "Pending manager review",
        resolvedBy: resolutions.get(`SEQUENCE_LOCK:${pack.id}`)?.resolvedByName ?? null,
      })),
      auditVariances: auditLines.map((line) => ({
        id: line.id,
        type: "INVENTORY_AUDIT",
        status: resolutions.has(`INVENTORY_AUDIT:${line.id}`) ? "RESOLVED" : "UNRESOLVED",
        game: line.pack.game.name,
        pack: line.pack.serialNumber,
        display: line.slotNumber,
        expected: line.endingExpectedTicket ?? line.expectedTicket,
        observed: line.endingPhysicalTicket ?? line.beginningPhysicalTicket,
        variance: line.variance,
        timestamp: line.audit.endedAt ?? line.audit.begunAt,
        actor: line.audit.endedBy?.name ?? line.audit.begunBy.name,
        reason: resolutions.get(`INVENTORY_AUDIT:${line.id}`)?.reason ?? line.varianceReason ?? "Inventory count does not match system expectation",
        resolvedBy: resolutions.get(`INVENTORY_AUDIT:${line.id}`)?.resolvedByName ?? null,
      })),
    });
  } catch (error) {
    console.error("[GET /api/reports/discrepancies]", error);
    return NextResponse.json({ error: "Unable to load discrepancies." }, { status: 500 });
  }
}
