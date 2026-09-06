import { SignJWT, jwtVerify } from "jose";

export interface SessionPayload {
  userId: string;
  storeId: string;
  storeName: string;
  name: string;
  email: string;
  role: "PLATFORM_ADMIN" | "OWNER" | "MANAGER" | "SHIFT_LEAD" | "EMPLOYEE";
  grantedPermissions: string[];
  impersonatedBy?: { userId: string; name: string; email: string };
}

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set in environment variables");
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(payload.impersonatedBy ? "30m" : "8h")
    .sign(getSecret());
}

export async function verifySession(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function signMfaChallenge(userId: string): Promise<string> {
  return new SignJWT({ type: "MFA_CHALLENGE", userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(getSecret());
}

export async function verifyMfaChallenge(token: string): Promise<{ userId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.type !== "MFA_CHALLENGE" || typeof payload.userId !== "string") return null;
    return { userId: payload.userId };
  } catch {
    return null;
  }
}

export const SESSION_COOKIE = "lottoops_session";
