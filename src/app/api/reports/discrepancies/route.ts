import { NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-session";
import { canAccessReports } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

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
    const auditLines = await prisma.inventoryAuditLine.findMany({
      where: { audit: { storeId: session.storeId }, variance: { not: 0 } },
      include: { pack: { select: { serialNumber: true, game: { select: { name: true } } } }, audit: { select: { status: true, begunAt: true, endedAt: true, begunBy: { select: { name: true } }, endedBy: { select: { name: true } } } } },
      orderBy: { id: "desc" },
    });

    return NextResponse.json({
      unresolved: lockedPacks.map((pack) => ({
        id: pack.id,
        type: "SEQUENCE_LOCK",
        status: "UNRESOLVED",
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
        reason: "Pending manager review",
      })),
      auditVariances: auditLines.map((line) => ({
        id: line.id,
        type: "INVENTORY_AUDIT",
        status: line.audit.status === "COMPLETED" ? "REVIEW" : "OPEN",
        game: line.pack.game.name,
        pack: line.pack.serialNumber,
        display: line.slotNumber,
        expected: line.endingExpectedTicket ?? line.expectedTicket,
        observed: line.endingPhysicalTicket ?? line.beginningPhysicalTicket,
        variance: line.variance,
        timestamp: line.audit.endedAt ?? line.audit.begunAt,
        actor: line.audit.endedBy?.name ?? line.audit.begunBy.name,
        reason: line.varianceReason ?? "Inventory count does not match system expectation",
      })),
    });
  } catch (error) {
    console.error("[GET /api/reports/discrepancies]", error);
    return NextResponse.json({ error: "Unable to load discrepancies." }, { status: 500 });
  }
}
