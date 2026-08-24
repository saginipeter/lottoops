import { cookies } from "next/headers";
import { verifySession, SESSION_COOKIE, SessionPayload } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();

  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) return null;

  const session = await verifySession(token);
  if (!session) return null;
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
      grantedPermissions: user.grantedPermissions ?? [],
    } as SessionPayload;
  } catch {
    return null;
  }
}