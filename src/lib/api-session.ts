import { cookies } from "next/headers";
import { verifySession, SESSION_COOKIE, SessionPayload } from "@/lib/session";

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
  return verifySession(token);
}