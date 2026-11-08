import { NextRequest, NextResponse } from "next/server";
import { verifySession, SESSION_COOKIE } from "@/lib/session";
import { clearAuthenticationCookies } from "@/lib/auth-cookies";

// Routes that don't require authentication
const PUBLIC_ROUTES = ["/login", "/setup", "/tv-display"];
const PUBLIC_PWA_ASSETS = ["/manifest.webmanifest", "/sw.js"];

function privateResponse(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "private, no-store, max-age=0, must-revalidate");
  response.headers.set("Pragma", "no-cache");
  return response;
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public routes and Next.js internals. Dynamic public screens and
  // authentication pages are still isolated from shared/browser caches.
  if (PUBLIC_ROUTES.includes(pathname) || pathname.startsWith("/api/auth/login") || pathname.startsWith("/api/setup")) {
    return privateResponse(NextResponse.next());
  }
  if (PUBLIC_PWA_ASSETS.includes(pathname) || pathname.startsWith("/_next") || pathname.startsWith("/favicon")) {
    return NextResponse.next();
  }

  // API routes perform their own auth and authorization checks; do not apply
  // page-level role redirects, but never allow private API payloads to be cached.
  if (pathname.startsWith("/api/")) {
    return privateResponse(NextResponse.next());
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;

  if (!token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("from", pathname);
    return privateResponse(NextResponse.redirect(loginUrl));
  }

  const session = await verifySession(token);

  if (!session) {
    // Token expired or invalid — clear cookie and prevent a cached protected redirect.
    const loginUrl = new URL("/login", req.url);
    const response = clearAuthenticationCookies(NextResponse.redirect(loginUrl));
    return privateResponse(response);
  }

  if (session.role === "AUDITOR") {
    const allowed = pathname === "/reports" || pathname.startsWith("/reports/") || pathname === "/documents" || pathname.startsWith("/documents/");
    if (!allowed) return privateResponse(NextResponse.redirect(new URL("/reports", req.url)));
    return privateResponse(NextResponse.next());
  }

  // Only owners can access the owner dashboard
  if (pathname.startsWith("/owner") && session.role !== "OWNER") {
    return privateResponse(NextResponse.redirect(new URL("/", req.url)));
  }

  if (pathname.startsWith("/inventory/live-scan")) {
    return privateResponse(NextResponse.redirect(new URL("/pos", req.url)));
  }

  if (pathname.startsWith("/platform") && session.role !== "PLATFORM_ADMIN") {
    return privateResponse(NextResponse.redirect(new URL("/", req.url)));
  }

  // EMPLOYEE: shift management and ticket POS only — no corrections or admin pages
  if (session.role === "EMPLOYEE") {
    const allowed =
      pathname === "/" ||
      pathname.startsWith("/employee") ||
      pathname.startsWith("/shifts") ||
      pathname.startsWith("/pos");
    if (!allowed) return privateResponse(NextResponse.redirect(new URL("/shifts", req.url)));
    return privateResponse(NextResponse.next());
  }

  // SHIFT_LEAD: shifts + scan always allowed; other sections require granted permissions
  if (session.role === "SHIFT_LEAD") {
    const granted = session.grantedPermissions ?? [];
    const alwaysAllowed =
      pathname === "/" ||
      pathname.startsWith("/shifts") ||
      pathname.startsWith("/pos");

    const conditionalAllowed =
      (pathname.startsWith("/reports") && granted.includes("REPORTS")) ||
      (pathname.startsWith("/inventory/receive") && granted.includes("RECEIVE_SHIPMENTS")) ||
      (pathname.startsWith("/inventory") && granted.includes("MANAGE_BACKSTOCK")) ||
      (pathname.startsWith("/display-slots") && granted.includes("MANAGE_DISPLAY")) ||
      (pathname.startsWith("/games") && granted.includes("MANAGE_GAMES"));

    if (!alwaysAllowed && !conditionalAllowed) {
      return privateResponse(NextResponse.redirect(new URL("/shifts", req.url)));
    }
    return privateResponse(NextResponse.next());
  }

  return privateResponse(NextResponse.next());
}

export const config = {
  // Run middleware on all routes except static files and public assets
  // (e.g. /brand/lottoops-logo.png must load on the login page itself,
  // before the visitor has a session).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|brand/|.*\\.(?:png|jpg|jpeg|svg|webp|gif|ico)$).*)",
  ],
};
