import { NextRequest, NextResponse } from "next/server";
import { verifySession, SESSION_COOKIE } from "@/lib/session";

// Routes that don't require authentication
const PUBLIC_ROUTES = ["/login"];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always allow public routes and Next.js internals
  if (
    PUBLIC_ROUTES.includes(pathname) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth/login") ||
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

  // Role-based route guards
  // Viewers can only see the dashboard overview and reports
  if (
    session.role === "VIEWER" &&
    !pathname.startsWith("/reports") &&
    pathname !== "/"
  ) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // Clerks cannot access settings or staff management
  if (session.role === "CLERK" && pathname.startsWith("/settings")) {
    return NextResponse.redirect(new URL("/", req.url));
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
