import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { clearAuthenticationCookies } from "@/lib/auth-cookies";
import { issueLoginEmailOtp, LoginEmailOtpRateLimitError } from "@/lib/login-email-otp";
import {
  LOGIN_EMAIL_OTP_CHALLENGE_COOKIE,
  SESSION_COOKIE,
  signLoginEmailOtpChallenge,
  verifySession,
} from "@/lib/session";
import { endLoginSession } from "@/lib/login-session";

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
    // No mock/offline escape is allowed for authentication because email OTP is
    // now mandatory. Missing DB/signing-key/mail configuration fails closed.
    if (!prisma || !process.env.JWT_SECRET || !(process.env.LOGIN_OTP_PEPPER || process.env.JWT_SECRET)) {
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

    const previousToken = req.cookies.get(SESSION_COOKIE)?.value;
    const previousSession = previousToken ? await verifySession(previousToken) : null;
    if (previousSession?.loginSessionId) await endLoginSession(previousSession.loginSessionId);

    let issued: { id: string };
    try {
      issued = await issueLoginEmailOtp(user.id, user.email);
    } catch (error) {
      if (error instanceof LoginEmailOtpRateLimitError) {
        return clearAuthenticationCookies(NextResponse.json({ error: "Please wait before requesting another code, or try again later." }, { status: 429 }));
      }
      console.error("[login email OTP] Delivery failed.");
      return clearAuthenticationCookies(NextResponse.json({ error: "Unable to send a verification code right now. Please try again." }, { status: 503 }));
    }

    const token = await signLoginEmailOtpChallenge(user.id, issued.id, requestedRememberMe === true);
    const response = clearAuthenticationCookies(NextResponse.json(
      { emailOtpRequired: true },
      { status: 202, headers: { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache" } },
    ));
    response.cookies.set(LOGIN_EMAIL_OTP_CHALLENGE_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 5 * 60,
      path: "/",
    });
    return response;
  } catch {
    console.error("[login] Password verification or challenge setup failed.");
    if (!prisma) return NextResponse.json({ error: "Secure sign-in is temporarily unavailable." }, { status: 503 });
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
