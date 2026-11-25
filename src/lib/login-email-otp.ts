import { createHmac, randomInt, randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";

export const LOGIN_EMAIL_OTP_TTL_SECONDS = 5 * 60;
export const LOGIN_EMAIL_OTP_MAX_ATTEMPTS = 5;
export const LOGIN_EMAIL_OTP_RESEND_COOLDOWN_SECONDS = 30;
export const LOGIN_EMAIL_OTP_MAX_SENDS_PER_HOUR = 5;
export const LOGIN_EMAIL_OTP_RATE_LIMIT_WINDOW_SECONDS = 60 * 60;

export class LoginEmailOtpRateLimitError extends Error {
  constructor() {
    super("A verification code was sent recently or the hourly limit was reached.");
    this.name = "LoginEmailOtpRateLimitError";
  }
}

function getOtpPepper() {
  const pepper = process.env.LOGIN_OTP_PEPPER || process.env.JWT_SECRET;
  if (!pepper) throw new Error("Email verification is not configured.");
  return pepper;
}

export function hashLoginEmailOtp(challengeId: string, userId: string, code: string) {
  return createHmac("sha256", getOtpPepper())
    .update(`lottoops-login-email-otp\0${challengeId}\0${userId}\0${code}`)
    .digest("hex");
}

/** Sends a login code using the same Resend account configuration as reports. */
export async function sendLoginEmailOtp(to: string, code: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.REPORT_EMAIL_FROM;
  if (!apiKey || !from) throw new Error("Email verification is not configured.");

  const text = `Your LottoOps sign-in verification code is ${code}. It expires in 5 minutes. If you did not try to sign in, you can ignore this email.`;
  const html = `<div style="font-family:Arial,sans-serif;color:#17233f;max-width:520px"><p style="font-size:12px;font-weight:700;letter-spacing:2px;color:#087da8">LOTTOOPS</p><h1 style="font-size:22px">Sign-in verification code</h1><p>Enter this code to finish signing in. It expires in 5 minutes.</p><p style="margin:24px 0;padding:16px;background:#f1f5f9;text-align:center;font-size:32px;font-weight:700;letter-spacing:8px">${code}</p><p style="font-size:13px;color:#64748b">If you did not try to sign in, you can ignore this email.</p></div>`;
  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject: "Your LottoOps sign-in code", text, html }),
    });
  } catch {
    throw new Error("Email delivery is temporarily unavailable.");
  }
  if (!response.ok) throw new Error("Email delivery is temporarily unavailable.");
}

/**
 * Reserves a per-user send slot and invalidates the prior code in one database
 * statement. The code is stored only as a keyed HMAC; plaintext exists only in
 * memory long enough to send the provider request.
 */
export async function issueLoginEmailOtp(userId: string, email: string) {
  if (!prisma) throw new Error("Database unavailable.");
  const id = randomUUID();
  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const codeHash = hashLoginEmailOtp(id, userId, code);
  const rows = await prisma.$queryRawUnsafe(
    `WITH delivery_limit AS (
       INSERT INTO login_email_otp_rate_limits (user_id, window_started_at, sent_count, last_sent_at)
       VALUES ($1, NOW(), 1, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         window_started_at = CASE
           WHEN login_email_otp_rate_limits.window_started_at <= NOW() - ($4::int * INTERVAL '1 second') THEN NOW()
           ELSE login_email_otp_rate_limits.window_started_at
         END,
         sent_count = CASE
           WHEN login_email_otp_rate_limits.window_started_at <= NOW() - ($4::int * INTERVAL '1 second') THEN 1
           ELSE login_email_otp_rate_limits.sent_count + 1
         END,
         last_sent_at = NOW()
       WHERE login_email_otp_rate_limits.last_sent_at <= NOW() - ($5::int * INTERVAL '1 second')
         AND (login_email_otp_rate_limits.window_started_at <= NOW() - ($4::int * INTERVAL '1 second')
           OR login_email_otp_rate_limits.sent_count < $6)
       RETURNING user_id
     ), invalidate_previous AS (
       UPDATE login_email_otp_challenges
       SET consumed_at = NOW()
       WHERE user_id = $1 AND consumed_at IS NULL
         AND EXISTS (SELECT 1 FROM delivery_limit)
       RETURNING id
     )
     INSERT INTO login_email_otp_challenges
       (id, user_id, code_hash, expires_at, attempt_count, created_at, consumed_at)
     SELECT $2, $1, $3, NOW() + ($7::int * INTERVAL '1 second'), 0, NOW(), NULL
     FROM delivery_limit
     RETURNING id`,
    userId,
    id,
    codeHash,
    LOGIN_EMAIL_OTP_RATE_LIMIT_WINDOW_SECONDS,
    LOGIN_EMAIL_OTP_RESEND_COOLDOWN_SECONDS,
    LOGIN_EMAIL_OTP_MAX_SENDS_PER_HOUR,
    LOGIN_EMAIL_OTP_TTL_SECONDS,
  ) as Array<{ id: string }>;
  if (rows.length === 0) throw new LoginEmailOtpRateLimitError();

  try {
    await sendLoginEmailOtp(email, code);
  } catch (error) {
    // A failed provider request must not leave a usable challenge behind.
    await prisma.$executeRawUnsafe(
      `UPDATE login_email_otp_challenges SET consumed_at = NOW() WHERE id = $1 AND consumed_at IS NULL`,
      id,
    ).catch(() => undefined);
    throw error;
  }
  return { id };
}

/** Atomically records an attempt and consumes a matching, unexpired code once. */
export async function consumeLoginEmailOtp(challengeId: string, userId: string, code: string) {
  if (!prisma) throw new Error("Database unavailable.");
  const candidateHash = hashLoginEmailOtp(challengeId, userId, code);
  const rows = await prisma.$queryRawUnsafe(
    `UPDATE login_email_otp_challenges
     SET attempt_count = attempt_count + 1,
         consumed_at = CASE
           WHEN code_hash = $3 AND expires_at > NOW() AND attempt_count < $4 THEN NOW()
           WHEN attempt_count + 1 >= $4 THEN NOW()
           ELSE consumed_at
         END
     WHERE id = $1 AND user_id = $2 AND consumed_at IS NULL
       AND expires_at > NOW() AND attempt_count < $4
     RETURNING (code_hash = $3) AS valid`,
    challengeId,
    userId,
    candidateHash,
    LOGIN_EMAIL_OTP_MAX_ATTEMPTS,
  ) as Array<{ valid: boolean }>;
  return rows[0]?.valid === true;
}

export async function invalidateLoginEmailOtp(challengeId: string) {
  if (!prisma) return;
  await prisma.$executeRawUnsafe(
    `UPDATE login_email_otp_challenges SET consumed_at = NOW() WHERE id = $1 AND consumed_at IS NULL`,
    challengeId,
  );
}

export async function isLoginEmailOtpActive(challengeId: string, userId: string) {
  if (!prisma) return false;
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id FROM login_email_otp_challenges
     WHERE id = $1 AND user_id = $2 AND consumed_at IS NULL AND expires_at > NOW()
     LIMIT 1`,
    challengeId,
    userId,
  ) as Array<{ id: string }>;
  return rows.length > 0;
}
