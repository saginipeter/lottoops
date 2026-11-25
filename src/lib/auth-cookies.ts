import type { NextResponse } from "next/server";
import { MFA_CHALLENGE_COOKIE, PLATFORM_SESSION_BACKUP_COOKIE, SESSION_COOKIE } from "@/lib/session";

export const AUTH_COOKIE_NAMES = [
  SESSION_COOKIE,
  MFA_CHALLENGE_COOKIE,
  PLATFORM_SESSION_BACKUP_COOKIE,
] as const;

export function clearAuthenticationCookies(response: NextResponse): NextResponse {
  for (const name of AUTH_COOKIE_NAMES) {
    response.cookies.set(name, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      path: "/",
    });
  }
  return response;
}
