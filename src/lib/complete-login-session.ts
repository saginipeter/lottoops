import { NextResponse } from "next/server";
import { clearAuthenticationCookies } from "@/lib/auth-cookies";
import { createLoginSessionId, startLoginSession } from "@/lib/login-session";
import { prisma } from "@/lib/prisma";
import { getSessionMaxAge, signSession, SESSION_COOKIE, type SessionPayload } from "@/lib/session";

export async function completeLoginWithSession(userId: string, rememberMe: boolean) {
  if (!prisma) throw new Error("Database unavailable.");
  const user = await prisma.user.findFirst({
    where: { id: userId, active: true },
    include: { store: true },
  });
  if (!user) return NextResponse.json({ error: "Account is inactive." }, { status: 401 });

  const staffRole = user.role === "EMPLOYEE" || user.role === "SHIFT_LEAD";
  const loginSessionId = createLoginSessionId();
  // Shift and terminal assignment happens after authentication. Deliberately
  // do not restore a historical shift here.
  await startLoginSession(loginSessionId, { storeId: user.storeId, userId: user.id });
  const token = await signSession({
    userId: user.id,
    storeId: user.storeId,
    storeName: user.store.name,
    name: user.name,
    email: user.email,
    role: user.role as SessionPayload["role"],
    grantedPermissions: user.grantedPermissions ?? [],
    rememberMe,
    loginSessionId,
  });
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const response = clearAuthenticationCookies(NextResponse.json({
    ok: true,
    user: {
      name: user.name,
      email: user.email,
      role: user.role,
      storeName: user.store.name,
      shiftNumber: null,
      terminalId: null,
      needsShiftSelection: staffRole,
    },
  }, { headers: { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache" } }));
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: getSessionMaxAge(rememberMe),
    path: "/",
  });
  return response;
}
