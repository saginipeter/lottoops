import { NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";
import { isManagerOrAbove } from "@/lib/permissions";
import { isStoreFeatureEnabled } from "@/lib/feature-flags";

export async function GET() {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!isManagerOrAbove(session)) return NextResponse.json({ error: "Manager access required." }, { status: 403 });
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  if (!(await isStoreFeatureEnabled(session.storeId, "AI_DISCREPANCY_ANALYSIS"))) return NextResponse.json({ error: "AI discrepancy analysis is disabled for this store." }, { status: 403 });
  try {
    const [auditVariances, locks] = await Promise.all([
      prisma.inventoryAuditLine.findMany({ where: { audit: { storeId: session.storeId }, variance: { not: 0 } }, select: { id: true, variance: true, audit: { select: { begunBy: { select: { name: true } }, endedBy: { select: { name: true } } } } }, take: 200 }),
      prisma.pack.findMany({ where: { storeId: session.storeId, sequenceLocked: true }, select: { id: true, serialNumber: true, sequenceLockExpectedTicket: true, sequenceLockScannedTicket: true } }),
    ]);
    const varianceTotal = auditVariances.reduce((sum: number, item: { variance: number | null }) => sum + Math.abs(Number(item.variance ?? 0)), 0);
    const actors = new Map<string, number>();
    auditVariances.forEach((item: { audit: { begunBy: { name: string }; endedBy: { name: string } | null } }) => { const name = item.audit.endedBy?.name ?? item.audit.begunBy.name; actors.set(name, (actors.get(name) ?? 0) + 1); });
    const repeatActors = Array.from(actors.entries()).filter(([, count]) => count > 1).map(([name, count]) => ({ name, count }));
    const risk = locks.length > 0 || varianceTotal >= 10 ? "HIGH" : auditVariances.length > 0 ? "MEDIUM" : "LOW";
    const findings = [
      ...(locks.length ? [{ type: "SEQUENCE_LOCKS", detail: `${locks.length} active sequence lock(s) require immediate review.` }] : []),
      ...(auditVariances.length ? [{ type: "AUDIT_VARIANCES", detail: `${auditVariances.length} audit variance(s) total ${varianceTotal} ticket positions.` }] : []),
      ...repeatActors.map((actor) => ({ type: "REPEAT_PATTERN", detail: `${actor.name} appears in ${actor.count} variance audits; review the related shift handoffs.` })),
    ];
    return NextResponse.json({ risk, findings, counts: { auditVariances: auditVariances.length, sequenceLocks: locks.length, repeatActors: repeatActors.length } });
  } catch (error) {
    console.error("[GET /api/reports/ai-discrepancy-analysis]", error);
    return NextResponse.json({ error: "Unable to analyze discrepancies." }, { status: 500 });
  }
}
