import { NextResponse } from "next/server";
import { clearAuthenticationCookies } from "@/lib/auth-cookies";

export async function POST() {
  const response = clearAuthenticationCookies(NextResponse.json({ ok: true }, {
    headers: { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache" },
  }));

  return response;
}
