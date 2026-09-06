import { NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-session";
import { isManagerOrAbove } from "@/lib/permissions";
import { resolveDiscrepancy } from "@/lib/discrepancy-resolution";

export async function POST(request: NextRequest) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!isManagerOrAbove(session)) return NextResponse.json({ error: "Manager access required." }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const type = typeof body.type === "string" ? body.type.trim() : "";
  const id = typeof body.id === "string" ? body.id.trim() : "";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!type || !id || reason.length < 6) return NextResponse.json({ error: "Discrepancy type, ID, and a reason of at least 6 characters are required." }, { status: 400 });
  try {
    await resolveDiscrepancy({ storeId: session.storeId, type, id, reason, userId: session.userId, userName: session.name });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[POST /api/reports/discrepancies/resolve]", error);
    return NextResponse.json({ error: "Unable to resolve discrepancy." }, { status: 500 });
  }
}
