-- Mandatory password + email OTP login challenges. Codes are stored only as keyed
-- HMAC hashes; no plaintext verification code is written to the database.
CREATE TABLE "login_email_otp_challenges" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "consumed_at" TIMESTAMPTZ,
    CONSTRAINT "login_email_otp_challenges_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "login_email_otp_challenges_attempt_count_check" CHECK ("attempt_count" BETWEEN 0 AND 5),
    CONSTRAINT "login_email_otp_challenges_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "login_email_otp_challenges_user_consumed_idx"
    ON "login_email_otp_challenges" ("user_id", "consumed_at");
CREATE INDEX "login_email_otp_challenges_expiry_idx"
    ON "login_email_otp_challenges" ("expires_at");

-- One row per user serializes concurrent sends and enforces a 30-second
-- cooldown plus a maximum of five sends in each one-hour window.
CREATE TABLE "login_email_otp_rate_limits" (
    "user_id" TEXT NOT NULL,
    "window_started_at" TIMESTAMPTZ NOT NULL,
    "sent_count" INTEGER NOT NULL,
    "last_sent_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "login_email_otp_rate_limits_pkey" PRIMARY KEY ("user_id"),
    CONSTRAINT "login_email_otp_rate_limits_sent_count_check" CHECK ("sent_count" BETWEEN 1 AND 5),
    CONSTRAINT "login_email_otp_rate_limits_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
