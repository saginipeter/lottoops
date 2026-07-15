import { NextRequest, NextResponse } from "next/server";
import { verifySession, SESSION_COOKIE } from "@/lib/session";

// Routes that don't require authentication
const PUBLIC_ROUTES = ["/login", "/setup"];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always allow public routes and Next.js internals
  if (
    PUBLIC_ROUTES.includes(pathname) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth/login") ||
    pathname.startsWith("/api/setup") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;

  if (!token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const session = await verifySession(token);

  if (!session) {
    // Token expired or invalid — clear cookie and redirect
    const loginUrl = new URL("/login", req.url);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete(SESSION_COOKIE);
    return response;
  }

  // Only owners can access the owner dashboard
  if (pathname.startsWith("/owner") && session.role !== "OWNER") {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // EMPLOYEE: shift open/close + live scan only — no corrections, no other pages
  if (session.role === "EMPLOYEE") {
    const allowed =
      pathname === "/" ||
      pathname.startsWith("/shifts") ||
      pathname.startsWith("/inventory/live-scan");
    if (!allowed) return NextResponse.redirect(new URL("/shifts", req.url));
    return NextResponse.next();
  }

  // SHIFT_LEAD: shifts + scan always allowed; other sections require granted permissions
  if (session.role === "SHIFT_LEAD") {
    const granted = session.grantedPermissions ?? [];
    const alwaysAllowed =
      pathname === "/" ||
      pathname.startsWith("/shifts") ||
      pathname.startsWith("/inventory/live-scan");

    const conditionalAllowed =
      (pathname.startsWith("/reports") && granted.includes("REPORTS")) ||
      (pathname.startsWith("/inventory/receive") && granted.includes("RECEIVE_SHIPMENTS")) ||
      (pathname.startsWith("/inventory") && granted.includes("MANAGE_BACKSTOCK")) ||
      (pathname.startsWith("/display-slots") && granted.includes("MANAGE_DISPLAY")) ||
      (pathname.startsWith("/games") && granted.includes("MANAGE_GAMES"));

    if (!alwaysAllowed && !conditionalAllowed) {
      return NextResponse.redirect(new URL("/shifts", req.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  // Run middleware on all routes except static files and public assets
  // (e.g. /brand/lottoops-logo.png must load on the login page itself,
  // before the visitor has a session).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|brand/|.*\\.(?:png|jpg|jpeg|svg|webp|gif|ico)$).*)",
  ],
};
