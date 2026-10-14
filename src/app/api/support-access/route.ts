import { NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";
import { logPlatformActivity } from "@/lib/platform-audit";
import { approveSupportAccess, isSameOriginMutation, listSupportRequests, requestSupportAccess, revokeSupportAccess, SupportAccessError } from "@/lib/support-access";

export async function GET() {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!prisma) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  try {
    return NextResponse.json({ requests: await listSupportRequests(session) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof SupportAccessError ? error.message : "Unable to load access requests." }, { status: error instanceof SupportAccessError ? 403 : 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Same-origin request required." }, { status: 403 });
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!prisma) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  try {
    if (body.action === "request" && typeof body.storeId === "string" && body.storeId.length <= 128) {
      const id = await requestSupportAccess(session, body.storeId);
      await logPlatformActivity({ action: "SUPPORT_ACCESS_REQUESTED", entityType: "STORE", entityId: body.storeId, detail: `Access request ${id} delivered to the store owner in-app.`, performedById: session.userId, performedByName: session.name });
      return NextResponse.json({ id });
    }
    if (typeof body.requestId !== "string" || body.requestId.length > 128) return NextResponse.json({ error: "Request ID required." }, { status: 400 });
    if (body.action === "approve") {
      const { token, storeId } = await approveSupportAccess(session, body.requestId);
      await logPlatformActivity({ action: "SUPPORT_ACCESS_APPROVED", entityType: "STORE", entityId: storeId, detail: `Owner approved access request ${body.requestId}.`, performedById: session.userId, performedByName: session.name });
      // Fragments keep bearer tokens out of HTTP URLs and server access logs.
      return NextResponse.json({ link: `${request.nextUrl.origin}/support#token=${token}`, expiresInMinutes: 15 }, { headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
    }
    if (body.action === "revoke") {
      const { storeId } = await revokeSupportAccess(session, body.requestId);
      await logPlatformActivity({ action: "SUPPORT_ACCESS_REVOKED", entityType: "STORE", entityId: storeId, detail: `Owner revoked access request ${body.requestId}.`, performedById: session.userId, performedByName: session.name });
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof SupportAccessError ? error.message : "Unable to update access request." }, { status: error instanceof SupportAccessError ? 403 : 500 });
  }
}
