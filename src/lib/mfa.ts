import * as OTPAuth from "otpauth";
import { prisma } from "@/lib/prisma";

let schemaReady = false;
async function ensureSchema() {
  if (schemaReady || !prisma) return;
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS user_mfa (user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, secret TEXT NOT NULL, enabled BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), enabled_at TIMESTAMPTZ)`);
  await prisma.$executeRawUnsafe(`ALTER TABLE user_mfa ADD COLUMN IF NOT EXISTS required BOOLEAN NOT NULL DEFAULT FALSE`);
  schemaReady = true;
}

export async function createMfaSetup(userId: string, email: string) {
  if (!prisma) throw new Error("Database unavailable");
  await ensureSchema();
  const secret = new OTPAuth.Secret({ size: 20 });
  const totp = new OTPAuth.TOTP({ issuer: "LottoOps", label: email, algorithm: "SHA1", digits: 6, period: 30, secret });
  await prisma.$executeRawUnsafe(`INSERT INTO user_mfa (user_id, secret, enabled) VALUES ($1, $2, FALSE) ON CONFLICT (user_id) DO UPDATE SET secret = EXCLUDED.secret, enabled = FALSE, enabled_at = NULL`, userId, secret.base32);
  return { uri: totp.toString(), secret: secret.base32 };
}

export async function verifyMfaCode(userId: string, code: string, enable = false) {
  if (!prisma) return false;
  await ensureSchema();
  const rows = await prisma.$queryRawUnsafe(`SELECT secret, enabled FROM user_mfa WHERE user_id = $1 LIMIT 1`, userId) as Array<{ secret: string; enabled: boolean }>;
  const record = rows[0];
  if (!record) return false;
  const totp = new OTPAuth.TOTP({ issuer: "LottoOps", label: userId, algorithm: "SHA1", digits: 6, period: 30, secret: OTPAuth.Secret.fromBase32(record.secret) });
  const valid = totp.validate({ token: code.replace(/\s/g, ""), window: 1 }) !== null;
  if (valid && enable) await prisma.$executeRawUnsafe(`UPDATE user_mfa SET enabled = TRUE, enabled_at = NOW() WHERE user_id = $1`, userId);
  return valid;
}

export async function isMfaEnabled(userId: string) {
  if (!prisma) return false;
  await ensureSchema();
  const rows = await prisma.$queryRawUnsafe(`SELECT enabled FROM user_mfa WHERE user_id = $1 LIMIT 1`, userId) as Array<{ enabled: boolean }>;
  return rows[0]?.enabled === true;
}

export async function isMfaRequired(userId: string) {
  if (!prisma) return false;
  await ensureSchema();
  const rows = await prisma.$queryRawUnsafe(`SELECT enabled, required FROM user_mfa WHERE user_id = $1 LIMIT 1`, userId) as Array<{ enabled: boolean; required: boolean }>;
  return rows[0]?.enabled === true || rows[0]?.required === true;
}

export async function setMfaRequired(userId: string, required: boolean) {
  if (!prisma) return;
  await ensureSchema();
  if (required) {
    const enrolled = await prisma.$queryRawUnsafe(`SELECT enabled FROM user_mfa WHERE user_id = $1 AND enabled = TRUE LIMIT 1`, userId) as Array<{ enabled: boolean }>;
    if (enrolled.length === 0) throw new Error("MFA_NOT_ENROLLED");
  }
  await prisma.$executeRawUnsafe(`INSERT INTO user_mfa (user_id, secret, required) VALUES ($1, '', $2) ON CONFLICT (user_id) DO UPDATE SET required = EXCLUDED.required`, userId, required);
}
