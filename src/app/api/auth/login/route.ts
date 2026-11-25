import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { clearAuthenticationCookies } from "@/lib/auth-cookies";
import { completeLoginWithSession } from "@/lib/complete-login-session";
import { endLoginSession } from "@/lib/login-session";
import { isMfaRequired } from "@/lib/mfa";
import { prisma } from "@/lib/prisma";
import {
  MFA_CHALLENGE_COOKIE,
  SESSION_COOKIE,
  signMfaChallenge,
  verifySession,
} from "@/lib/session";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
    }

    const { email, password, rememberMe: requestedRememberMe } = body as {
      email?: unknown;
      password?: unknown;
      rememberMe?: unknown;
    };
    if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }
    if (!prisma || !process.env.JWT_SECRET) {
      return NextResponse.json({ error: "Secure sign-in is temporarily unavailable." }, { status: 503 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    let user;
    try {
      user = await prisma.user.findUnique({ where: { email: normalizedEmail }, include: { store: true } });
    } catch {
      return NextResponse.json({ error: "Database is temporarily unavailable. Please try again." }, { status: 503 });
    }
    if (!user || !user.active || !(await bcrypt.compare(password, user.passwordHash))) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    const rememberMe = requestedRememberMe === true;
    const previousToken = req.cookies.get(SESSION_COOKIE)?.value;
    const previousSession = previousToken ? await verifySession(previousToken) : null;
    if (previousSession?.loginSessionId) await endLoginSession(previousSession.loginSessionId);

    if (await isMfaRequired(user.id)) {
      const response = clearAuthenticationCookies(NextResponse.json(
        { mfaRequired: true },
        { status: 202, headers: { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache" } },
      ));
      response.cookies.set(MFA_CHALLENGE_COOKIE, await signMfaChallenge(user.id, rememberMe), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 5 * 60,
        path: "/",
      });
      return response;
    }

    return await completeLoginWithSession(user.id, rememberMe);
  } catch {
    console.error("[login] Password verification or session creation failed.");
    if (!prisma || !process.env.JWT_SECRET) {
      return NextResponse.json({ error: "Secure sign-in is temporarily unavailable." }, { status: 503 });
    }
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
