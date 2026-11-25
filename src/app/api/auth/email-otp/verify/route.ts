import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isMfaRequired } from "@/lib/mfa";
import { consumeLoginEmailOtp } from "@/lib/login-email-otp";
import { completeLoginWithSession } from "@/lib/complete-login-session";
import {
  clearAuthenticationCookies,
} from "@/lib/auth-cookies";
import {
  LOGIN_EMAIL_OTP_CHALLENGE_COOKIE,
  MFA_CHALLENGE_COOKIE,
  signMfaChallenge,
  verifyLoginEmailOtpChallenge,
} from "@/lib/session";

export async function POST(request: NextRequest) {
  const challengeToken = request.cookies.get(LOGIN_EMAIL_OTP_CHALLENGE_COOKIE)?.value;
  if (!challengeToken) return NextResponse.json({ error: "Verification expired. Sign in again." }, { status: 401 });
  const challenge = await verifyLoginEmailOtpChallenge(challengeToken);
  if (!challenge || !prisma) return NextResponse.json({ error: "Verification expired. Sign in again." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const code = typeof body.code === "string" ? body.code : "";
  if (!/^\d{6}$/.test(code)) return NextResponse.json({ error: "Enter the 6-digit code sent to your email." }, { status: 400 });

  let valid: boolean;
  try {
    valid = await consumeLoginEmailOtp(challenge.challengeId, challenge.userId, code);
  } catch {
    return NextResponse.json({ error: "Verification is temporarily unavailable." }, { status: 503 });
  }
  if (!valid) return NextResponse.json({ error: "That code is invalid, expired, or already used. Check it or request a new code." }, { status: 401 });

  const user = await prisma.user.findFirst({ where: { id: challenge.userId, active: true }, select: { id: true } });
  if (!user) return NextResponse.json({ error: "Account is inactive." }, { status: 401 });

  let authenticatorRequired: boolean;
  try {
    authenticatorRequired = await isMfaRequired(challenge.userId);
  } catch {
    return NextResponse.json({ error: "Additional security verification is temporarily unavailable." }, { status: 503 });
  }
  if (authenticatorRequired) {
    const token = await signMfaChallenge(challenge.userId, challenge.rememberMe, undefined, true);
    const response = clearAuthenticationCookies(NextResponse.json(
      { mfaRequired: true },
      { status: 202, headers: { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache" } },
    ));
    response.cookies.set(MFA_CHALLENGE_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 5 * 60,
      path: "/",
    });
    return response;
  }

  try {
    return await completeLoginWithSession(challenge.userId, challenge.rememberMe);
  } catch {
    console.error("[login email OTP] Session creation failed.");
    return NextResponse.json({ error: "Unable to finish signing in. Please try again." }, { status: 503 });
  }
}
