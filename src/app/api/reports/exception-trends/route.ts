import { NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";
import { canAccessReports } from "@/lib/permissions";
import { parseReportDateRange } from "@/lib/report-date-range";

export async function GET(req: NextRequest) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!canAccessReports(session)) return NextResponse.json({ error: "Reports access required." }, { status: 403 });
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const range = parseReportDateRange(req.nextUrl.searchParams);
  if ("error" in range) return NextResponse.json({ error: range.error }, { status: 400 });
  const since = range.fromDate;
  const until = range.toDate;
  try {
    const [auditRows, lockedPacksResult] = await Promise.all([
      prisma.inventoryAuditLine.findMany({ where: { audit: { storeId: session.storeId, endedAt: { gte: since, lte: until } }, variance: { not: 0 } }, select: { id: true, audit: { select: { endedAt: true } } } }),
      prisma.pack.findMany({ where: { storeId: session.storeId, sequenceLocked: true, sequenceLockedAt: { gte: since, lte: until } }, select: { id: true, sequenceLockedAt: true } }),
    ]);
    const lockedPacks = lockedPacksResult as Array<{ id: string; sequenceLockedAt: Date | null }>;
    let resolutions: Array<{ type: string; id: string; resolvedAt: Date }> = [];
    try { resolutions = await prisma.$queryRawUnsafe(`SELECT discrepancy_type AS type, discrepancy_id AS id, resolved_at AS "resolvedAt" FROM discrepancy_resolutions WHERE store_id = $1 AND resolved_at >= $2 AND resolved_at <= $3`, session.storeId, since, until) as typeof resolutions; } catch { /* Resolution table initializes when first used. */ }
    const byDay = new Map<string, { date: string; auditVariances: number; sequenceLocks: number; resolved: number }>();
    const ensureDay = (date: Date) => { const key = date.toISOString().slice(0, 10); const current = byDay.get(key) ?? { date: key, auditVariances: 0, sequenceLocks: 0, resolved: 0 }; byDay.set(key, current); return current; };
    auditRows.forEach((row: { id: string; audit: { endedAt: Date | null } }) => { if (row.audit.endedAt) ensureDay(row.audit.endedAt).auditVariances += 1; });
    lockedPacks.forEach((pack) => { if (pack.sequenceLockedAt) ensureDay(pack.sequenceLockedAt).sequenceLocks += 1; });
    resolutions.forEach((resolution) => { ensureDay(resolution.resolvedAt).resolved += 1; });
    const totals = Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date));
    return NextResponse.json({ since: since.toISOString(), until: until.toISOString(), totals, summary: { auditVariances: auditRows.length, openSequenceLocks: lockedPacks.length, resolved: resolutions.length } });
  } catch (error) {
    console.error("[GET /api/reports/exception-trends]", error);
    return NextResponse.json({ error: "Unable to load exception trends." }, { status: 500 });
  }
}
