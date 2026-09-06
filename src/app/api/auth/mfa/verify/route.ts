import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { signSession, verifyMfaChallenge, SESSION_COOKIE } from "@/lib/session";
import { verifyMfaCode } from "@/lib/mfa";

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const challengeToken = cookieStore.get("lottoops_mfa_challenge")?.value;
  if (!challengeToken) return NextResponse.json({ error: "MFA challenge expired. Sign in again." }, { status: 401 });
  const challenge = await verifyMfaChallenge(challengeToken);
  if (!challenge || !prisma) return NextResponse.json({ error: "MFA challenge is invalid." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const code = typeof body.code === "string" ? body.code : "";
  if (!/^\d{6}$/.test(code)) return NextResponse.json({ error: "Enter the 6-digit authenticator code." }, { status: 400 });
  if (!(await verifyMfaCode(challenge.userId, code))) return NextResponse.json({ error: "Invalid authenticator code." }, { status: 401 });

  const user = await prisma.user.findFirst({ where: { id: challenge.userId, active: true }, include: { store: true } });
  if (!user) return NextResponse.json({ error: "Account is inactive." }, { status: 401 });
  const token = await signSession({ userId: user.id, storeId: user.storeId, storeName: user.store.name, name: user.name, email: user.email, role: user.role, grantedPermissions: user.grantedPermissions ?? [] });
  const response = NextResponse.json({ ok: true, user: { name: user.name, email: user.email, role: user.role, storeName: user.store.name } });
  response.cookies.set(SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 60 * 60 * 8, path: "/" });
  response.cookies.delete("lottoops_mfa_challenge");
  return response;
}
