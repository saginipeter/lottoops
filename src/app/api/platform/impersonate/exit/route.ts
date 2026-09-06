import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession, SESSION_COOKIE } from "@/lib/session";

const BACKUP_COOKIE = "lottoops_platform_session_backup";

export async function POST() {
  const cookieStore = await cookies();
  const backup = cookieStore.get(BACKUP_COOKIE)?.value;
  if (!backup) return NextResponse.json({ error: "No Platform Admin session to restore." }, { status: 400 });
  const session = await verifySession(backup);
  if (!session || session.role !== "PLATFORM_ADMIN") return NextResponse.json({ error: "Backup Platform Admin session is invalid or expired." }, { status: 401 });
  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE, backup, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 60 * 60 * 8, path: "/" });
  response.cookies.delete(BACKUP_COOKIE);
  return response;
}
