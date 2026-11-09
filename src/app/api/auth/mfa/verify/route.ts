import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getSessionMaxAge, signSession, verifyMfaChallenge, MFA_CHALLENGE_COOKIE, SESSION_COOKIE } from "@/lib/session";
import { verifyMfaCode } from "@/lib/mfa";
import { clearAuthenticationCookies } from "@/lib/auth-cookies";
import { createLoginSessionId, startLoginSession } from "@/lib/login-session";

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const challengeToken = cookieStore.get(MFA_CHALLENGE_COOKIE)?.value;
  if (!challengeToken) return NextResponse.json({ error: "MFA challenge expired. Sign in again." }, { status: 401 });
  const challenge = await verifyMfaChallenge(challengeToken);
  if (!challenge || !prisma) return NextResponse.json({ error: "MFA challenge is invalid." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const code = typeof body.code === "string" ? body.code : "";
  if (!/^\d{6}$/.test(code)) return NextResponse.json({ error: "Enter the 6-digit authenticator code." }, { status: 400 });
  if (!(await verifyMfaCode(challenge.userId, code))) return NextResponse.json({ error: "Invalid authenticator code." }, { status: 401 });

  const user = await prisma.user.findFirst({ where: { id: challenge.userId, active: true }, include: { store: true } });
  if (!user) return NextResponse.json({ error: "Account is inactive." }, { status: 401 });
  let shiftAssignment: { shiftId: string; shiftNumber: 1 | 2 | 3; terminalId: string } | undefined;
  if (user.role === "EMPLOYEE" || user.role === "SHIFT_LEAD") {
    if (!challenge.shiftId || !challenge.shiftNumber) {
      return NextResponse.json({ error: "Shift selection was not preserved. Sign in again and select an open shift." }, { status: 409 });
    }
    const openShift = await prisma.shift.findFirst({
      where: { id: challenge.shiftId, storeId: user.storeId, status: "OPEN", shiftNumber: challenge.shiftNumber, terminalId: challenge.terminalId },
      select: { id: true, terminalId: true },
    });
    if (!openShift) return NextResponse.json({ error: "The selected shift is no longer open. Sign in again and choose an available shift." }, { status: 409 });
    if (!openShift.terminalId) return NextResponse.json({ error: "The selected shift no longer has a terminal assignment. Ask a manager to reopen it." }, { status: 409 });
    shiftAssignment = { shiftId: openShift.id, shiftNumber: challenge.shiftNumber, terminalId: openShift.terminalId };
  }
  const loginSessionId = createLoginSessionId();
  await startLoginSession(loginSessionId, { storeId: user.storeId, userId: user.id, ...(shiftAssignment ? { shiftId: shiftAssignment.shiftId, terminalId: shiftAssignment.terminalId } : {}) });
  const token = await signSession({ userId: user.id, storeId: user.storeId, storeName: user.store.name, name: user.name, email: user.email, role: user.role, grantedPermissions: user.grantedPermissions ?? [], rememberMe: challenge.rememberMe, ...shiftAssignment, loginSessionId });
  const response = clearAuthenticationCookies(NextResponse.json({ ok: true, user: { name: user.name, email: user.email, role: user.role, storeName: user.store.name, shiftNumber: shiftAssignment?.shiftNumber ?? null, terminalId: shiftAssignment?.terminalId ?? null } }, { headers: { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache" } }));
  response.cookies.set(SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: getSessionMaxAge(challenge.rememberMe), path: "/" });
  return response;
}
