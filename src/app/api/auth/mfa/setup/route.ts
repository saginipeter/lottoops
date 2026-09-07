import { NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-session";
import { createMfaSetup, verifyMfaCode, isMfaEnabled } from "@/lib/mfa";
import { disableMfa } from "@/lib/mfa";
import { revokeUserSessions } from "@/lib/session-revocation";

export async function GET() {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  return NextResponse.json({ enabled: await isMfaEnabled(session.userId) });
}

export async function POST(request: NextRequest) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  if (typeof body.code === "string" && body.code.trim()) {
    const valid = await verifyMfaCode(session.userId, body.code.trim(), true);
    return valid ? NextResponse.json({ enabled: true }) : NextResponse.json({ error: "Invalid authenticator code." }, { status: 400 });
  }
  try {
    const setup = await createMfaSetup(session.userId, session.email);
    return NextResponse.json(setup);
  } catch (error) {
    console.error("[POST /api/auth/mfa/setup]", error);
    return NextResponse.json({ error: "Unable to start MFA setup." }, { status: 500 });
  }
}

export async function DELETE() {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  await disableMfa(session.userId);
  await revokeUserSessions(session.userId);
  return NextResponse.json({ success: true });
}
