-- Scope active numbered shifts to a terminal, while preserving any existing
-- open Shift 3 rows for manager-led closeout and all closed Shift 3 history.
UPDATE "shifts"
SET "terminalId" = 'T1'
WHERE status = 'OPEN' AND "terminalId" IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "shifts"
    WHERE status = 'OPEN'
      AND "terminalId" IS NOT NULL
      AND "terminalId" !~ '^T[0-9]{1,3}$'
  ) THEN
    RAISE EXCEPTION 'An open shift has an invalid terminal identifier; correct it before enabling terminal-scoped shifts.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "shifts"
    WHERE status = 'OPEN'
    GROUP BY "storeId", "terminalId", "shift_number"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'A terminal has duplicate open numbered shifts; reconcile them before enabling terminal-scoped shifts.';
  END IF;
END $$;

DROP INDEX IF EXISTS "shifts_one_open_number_per_store_idx";
CREATE UNIQUE INDEX IF NOT EXISTS "shifts_one_open_number_per_terminal_idx"
ON "shifts" ("storeId", "terminalId", "shift_number")
WHERE status = 'OPEN' AND "shift_number" IS NOT NULL AND "terminalId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "shifts_store_terminal_status_number_idx"
ON "shifts" ("storeId", "terminalId", status, "shift_number");

CREATE TABLE IF NOT EXISTS "login_sessions" (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shift_id TEXT REFERENCES shifts(id) ON DELETE SET NULL,
  terminal_id TEXT,
  signed_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  CONSTRAINT "login_sessions_terminal_id_format"
    CHECK (terminal_id IS NULL OR terminal_id ~ '^T[0-9]{1,3}$')
);
CREATE INDEX IF NOT EXISTS "login_sessions_store_shift_user_idx"
ON "login_sessions" (store_id, shift_id, user_id, signed_in_at DESC);
CREATE INDEX IF NOT EXISTS "login_sessions_user_ended_idx"
ON "login_sessions" (user_id, ended_at);

ALTER TABLE "live_scan_events" ADD COLUMN IF NOT EXISTS terminal_id TEXT;
ALTER TABLE "live_scan_events"
  ADD COLUMN IF NOT EXISTS login_session_id TEXT REFERENCES "login_sessions"(id) ON DELETE SET NULL;
ALTER TABLE "live_scan_events" ADD COLUMN IF NOT EXISTS ticket_price NUMERIC(10,2);
ALTER TABLE "live_scan_events" ADD COLUMN IF NOT EXISTS ticket_price_source TEXT NOT NULL DEFAULT 'RECORDED';
ALTER TABLE "live_scan_events" ADD COLUMN IF NOT EXISTS display_number TEXT;

UPDATE "live_scan_events" AS event
SET ticket_price = COALESCE(pack."ticketPrice", game.price),
    ticket_price_source = 'BACKFILLED'
FROM packs AS pack
JOIN games AS game ON game.id = pack."gameId"
WHERE event.pack_id = pack.id AND event.ticket_price IS NULL;

CREATE INDEX IF NOT EXISTS "live_scan_events_shift_session_idx"
ON "live_scan_events" (store_id, shift_id, login_session_id, scanned_at);
CREATE INDEX IF NOT EXISTS "live_scan_events_shift_terminal_idx"
ON "live_scan_events" (store_id, shift_id, terminal_id, scanned_at);
