import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getApiSession } from "@/lib/api-session";
import { getSessionMaxAge, verifySession, PLATFORM_SESSION_BACKUP_COOKIE, SESSION_COOKIE } from "@/lib/session";
import { isSameOriginMutation } from "@/lib/support-access";

export async function POST(request: NextRequest) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Same-origin request required." }, { status: 403 });
  const cookieStore = await cookies();
  const backup = cookieStore.get(PLATFORM_SESSION_BACKUP_COOKIE)?.value;
  if (!backup) return NextResponse.json({ error: "No Platform Admin session to restore." }, { status: 400 });
  const session = await verifySession(backup);
  if (!session || session.role !== "PLATFORM_ADMIN") {
    const response = NextResponse.json({ error: "Backup Platform Admin session is invalid or expired." }, { status: 401 });
    response.cookies.set(PLATFORM_SESSION_BACKUP_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 0, path: "/" });
    return response;
  }
  const activeSession = await getApiSession();
  if (!activeSession || activeSession.role !== "MANAGER" || !activeSession.impersonatedBy || !activeSession.supportAccessId || activeSession.impersonatedBy.userId !== session.userId) {
    const response = NextResponse.json({ error: "The active support session does not match this Platform Admin backup." }, { status: 403 });
    response.cookies.set(PLATFORM_SESSION_BACKUP_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 0, path: "/" });
    return response;
  }
  const response = NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache" } });
  response.cookies.set(SESSION_COOKIE, backup, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: getSessionMaxAge(session.rememberMe), path: "/" });
  response.cookies.delete(PLATFORM_SESSION_BACKUP_COOKIE);
  return response;
}
