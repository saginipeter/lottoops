ALTER TABLE "shifts"
ADD COLUMN IF NOT EXISTS "shift_number" INTEGER;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "shifts"
    WHERE status = 'OPEN'
    GROUP BY "storeId"
    HAVING COUNT(*) > 3
  ) THEN
    RAISE EXCEPTION 'A store has more than three open shifts; close or reconcile excess shifts before deploying numbered shifts.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "shifts"
    WHERE status = 'OPEN' AND "shift_number" IS NOT NULL
    GROUP BY "storeId", "shift_number"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'A store has duplicate numbered open shifts; reconcile shift numbers before deploying numbered shifts.';
  END IF;
END $$;

WITH unnumbered_open_shifts AS (
  SELECT id, "storeId",
    ROW_NUMBER() OVER (PARTITION BY "storeId" ORDER BY "openedAt" DESC, id) AS number_rank
  FROM "shifts"
  WHERE status = 'OPEN' AND "shift_number" IS NULL
), available_numbers AS (
  SELECT stores."storeId", numbers.shift_number,
    ROW_NUMBER() OVER (PARTITION BY stores."storeId" ORDER BY numbers.shift_number) AS number_rank
  FROM (SELECT DISTINCT "storeId" FROM unnumbered_open_shifts) AS stores
  CROSS JOIN (VALUES (1), (2), (3)) AS numbers(shift_number)
  WHERE NOT EXISTS (
    SELECT 1 FROM "shifts" AS occupied
    WHERE occupied."storeId" = stores."storeId"
      AND occupied.status = 'OPEN'
      AND occupied."shift_number" = numbers.shift_number
  )
)
UPDATE "shifts" AS shifts
SET "shift_number" = available_numbers.shift_number
FROM unnumbered_open_shifts
JOIN available_numbers USING ("storeId", number_rank)
WHERE shifts.id = unnumbered_open_shifts.id;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "shifts"
    WHERE status = 'OPEN' AND "shift_number" IS NULL
  ) THEN
    RAISE EXCEPTION 'Unable to assign all open shifts a unique number from 1 to 3.';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'shifts_shift_number_range_check'
  ) THEN
    ALTER TABLE "shifts"
      ADD CONSTRAINT "shifts_shift_number_range_check"
      CHECK ("shift_number" IS NULL OR "shift_number" BETWEEN 1 AND 3);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "shifts_store_shift_number_status_idx"
ON "shifts" ("storeId", "shift_number", "status");

CREATE UNIQUE INDEX IF NOT EXISTS "shifts_one_open_number_per_store_idx"
ON "shifts" ("storeId", "shift_number")
WHERE status = 'OPEN' AND "shift_number" IS NOT NULL;

ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "terminalId" TEXT;
ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "openingCash" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "expectedCash" DECIMAL(12,2);
ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "countedCash" DECIMAL(12,2);
ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "cashVariance" DECIMAL(12,2);
ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "cashReconciledAt" TIMESTAMPTZ;
ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "cashReconciledById" TEXT;

CREATE TABLE IF NOT EXISTS "live_scan_events" (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  shift_id TEXT NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  pack_id TEXT NOT NULL REFERENCES packs(id) ON DELETE CASCADE,
  ticket_barcode TEXT NOT NULL,
  client_request_id TEXT,
  scanned_by_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(store_id, shift_id, ticket_barcode)
);
ALTER TABLE "live_scan_events"
  ADD COLUMN IF NOT EXISTS scanned_by_id TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE "live_scan_events" ADD COLUMN IF NOT EXISTS client_request_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "live_scan_events_store_shift_ticket_idx"
  ON "live_scan_events" (store_id, shift_id, ticket_barcode);
CREATE UNIQUE INDEX IF NOT EXISTS "live_scan_events_store_client_request_idx"
  ON "live_scan_events" (store_id, client_request_id)
  WHERE client_request_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS "shift_participants" (
  shift_id TEXT NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (shift_id, user_id)
);

CREATE TABLE IF NOT EXISTS "store_security_settings" (
  store_id TEXT PRIMARY KEY REFERENCES stores(id) ON DELETE CASCADE,
  approval_pin_hash TEXT NOT NULL,
  updated_by_id TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
