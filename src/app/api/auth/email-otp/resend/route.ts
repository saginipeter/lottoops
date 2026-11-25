import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isLoginEmailOtpActive, issueLoginEmailOtp, LoginEmailOtpRateLimitError } from "@/lib/login-email-otp";
import {
  LOGIN_EMAIL_OTP_CHALLENGE_COOKIE,
  signLoginEmailOtpChallenge,
  verifyLoginEmailOtpChallenge,
} from "@/lib/session";

export async function POST(request: NextRequest) {
  const token = request.cookies.get(LOGIN_EMAIL_OTP_CHALLENGE_COOKIE)?.value;
  const challenge = token ? await verifyLoginEmailOtpChallenge(token) : null;
  if (!challenge || !prisma) return NextResponse.json({ error: "Verification expired. Sign in again." }, { status: 401 });

  try {
    if (!(await isLoginEmailOtpActive(challenge.challengeId, challenge.userId))) {
      return NextResponse.json({ error: "Verification expired. Sign in again." }, { status: 401 });
    }
  } catch {
    return NextResponse.json({ error: "Verification is temporarily unavailable." }, { status: 503 });
  }

  const user = await prisma.user.findFirst({
    where: { id: challenge.userId, active: true },
    select: { id: true, email: true },
  });
  if (!user) return NextResponse.json({ error: "Account is inactive." }, { status: 401 });

  try {
    const next = await issueLoginEmailOtp(user.id, user.email);
    const nextToken = await signLoginEmailOtpChallenge(user.id, next.id, challenge.rememberMe);
    const response = NextResponse.json({ emailOtpRequired: true }, {
      headers: { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache" },
    });
    response.cookies.set(LOGIN_EMAIL_OTP_CHALLENGE_COOKIE, nextToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 5 * 60,
      path: "/",
    });
    return response;
  } catch (error) {
    if (error instanceof LoginEmailOtpRateLimitError) {
      return NextResponse.json({ error: "Please wait before requesting another code, or try again later." }, { status: 429 });
    }
    return NextResponse.json({ error: "Unable to send a verification code right now. Please try again." }, { status: 503 });
  }
}
