import { NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-session";
import { queryInventoryActivity } from "@/lib/activity-log";

export async function GET(req: NextRequest) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const logs = await queryInventoryActivity(session.storeId, {
    from: from ? new Date(from + "T00:00:00") : undefined,
    to: to ? new Date(to + "T23:59:59") : undefined,
    limit: 1000,
  });

  return NextResponse.json({ logs });
}
