import { NextRequest, NextResponse } from "next/server";
import { completeLoginWithSession } from "@/lib/complete-login-session";
import { verifyMfaCode } from "@/lib/mfa";
import { prisma } from "@/lib/prisma";
import { MFA_CHALLENGE_COOKIE, verifyMfaChallenge } from "@/lib/session";

export async function POST(request: NextRequest) {
  const challengeToken = request.cookies.get(MFA_CHALLENGE_COOKIE)?.value;
  if (!challengeToken) return NextResponse.json({ error: "MFA challenge expired. Sign in again." }, { status: 401 });
  const challenge = await verifyMfaChallenge(challengeToken);
  if (!challenge || !prisma) return NextResponse.json({ error: "MFA challenge is invalid." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const code = typeof body.code === "string" ? body.code : "";
  if (!/^\d{6}$/.test(code)) return NextResponse.json({ error: "Enter the 6-digit authenticator code." }, { status: 400 });

  try {
    if (!(await verifyMfaCode(challenge.userId, code))) {
      return NextResponse.json({ error: "Invalid authenticator code." }, { status: 401 });
    }
    return await completeLoginWithSession(challenge.userId, challenge.rememberMe);
  } catch {
    console.error("[login MFA] Verification or session creation failed.");
    return NextResponse.json({ error: "Unable to finish signing in. Please try again." }, { status: 503 });
  }
}
