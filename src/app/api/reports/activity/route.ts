import { NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-session";
import { queryInventoryActivity } from "@/lib/activity-log";
import { parseReportDateRange } from "@/lib/report-date-range";

export async function GET(req: NextRequest) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const range = parseReportDateRange(searchParams);
  if ("error" in range) return NextResponse.json({ error: range.error }, { status: 400 });

  const logs = await queryInventoryActivity(session.storeId, {
    from: range.fromDate,
    to: range.toDate,
    limit: 1000,
  });

  return NextResponse.json({
    logs: logs.map((log: { id: bigint | number | string; [key: string]: unknown }) => ({
      ...log,
      id: typeof log.id === "bigint" ? log.id.toString() : log.id,
    })),
  });
}
