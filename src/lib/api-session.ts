import { cookies } from "next/headers";
import { verifySession, SESSION_COOKIE, SessionPayload } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { isSessionRevoked } from "@/lib/session-revocation";
import { isStoreSuspended } from "@/lib/store-access";
import { getRoleDefaultPermissions } from "@/lib/feature-flags";

/**
 * Reads and verifies the session cookie inside an API route. Returns null
 * if there's no session or it's invalid/expired — callers should respond
 * 401 in that case. Route-level middleware already blocks unauthenticated
 * requests from reaching most pages, but API routes need their own check
 * since middleware only guards page navigation, not fetch() calls made
 * from the client.
 */
export async function getApiSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await verifySession(token);
  if (!session) return null;
  if (await isSessionRevoked(session)) return null;
  if (session.role !== "PLATFORM_ADMIN" && await isStoreSuspended(session.storeId)) return null;
  if (!prisma) return process.env.NODE_ENV === "development" && process.env.ALLOW_OFFLINE_AUTH === "true" ? session : null;

  try {
    const user = await prisma.user.findFirst({
      where: { id: session.userId, active: true, storeId: session.storeId },
      include: { store: { select: { name: true } } },
    });
    if (!user) return null;
    return {
      ...session,
      storeName: user.store.name,
      name: user.name,
      email: user.email,
      role: user.role,
      grantedPermissions: Array.from(new Set([
        ...(user.grantedPermissions ?? []),
        ...(await getRoleDefaultPermissions(user.role)),
      ])),
    } as SessionPayload;
  } catch {
    return null;
  }
}