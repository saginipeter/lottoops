import { SignJWT, jwtVerify } from "jose";

const KIOSK_TOKEN_TYPE = "TV_KIOSK";
const DEFAULT_TTL_SECONDS = 30 * 24 * 60 * 60;

export interface TvKioskPayload {
  type: typeof KIOSK_TOKEN_TYPE;
  storeId: string;
  storeName: string;
}

function getKioskSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set in environment variables");
  return new TextEncoder().encode(secret);
}

export async function signTvKioskToken(
  payload: Omit<TvKioskPayload, "type">,
  ttlSeconds = DEFAULT_TTL_SECONDS,
): Promise<string> {
  const ttl = Math.min(Math.max(Math.floor(ttlSeconds), 1), DEFAULT_TTL_SECONDS);
  return new SignJWT({ ...payload, type: KIOSK_TOKEN_TYPE })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ttl}s`)
    .sign(getKioskSecret());
}

export async function verifyTvKioskToken(token: string): Promise<TvKioskPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getKioskSecret());
    if (
      payload.type !== KIOSK_TOKEN_TYPE ||
      typeof payload.storeId !== "string" ||
      typeof payload.storeName !== "string"
    ) {
      return null;
    }
    return {
      type: KIOSK_TOKEN_TYPE,
      storeId: payload.storeId,
      storeName: payload.storeName,
    };
  } catch {
    return null;
  }
}
