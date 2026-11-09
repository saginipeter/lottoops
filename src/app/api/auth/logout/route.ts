import { NextResponse } from "next/server";
import { clearAuthenticationCookies } from "@/lib/auth-cookies";
import type { NextRequest } from "next/server";
import { endLoginSession } from "@/lib/login-session";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

export async function POST(request?: NextRequest) {
  const token = request?.cookies.get(SESSION_COOKIE)?.value;
  if (token) {
    try {
      const session = await verifySession(token);
      if (session?.loginSessionId) await endLoginSession(session.loginSessionId);
    } catch (error) {
      console.warn("Unable to finalize login-session record during logout:", error);
    }
  }
  const response = clearAuthenticationCookies(NextResponse.json({ ok: true }, {
    headers: { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache" },
  }));

  return response;
}
