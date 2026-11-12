-- Persist operational alert acknowledgments without mutating their source records.
CREATE TABLE IF NOT EXISTS "operational_alert_acknowledgments" (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  alert_key TEXT NOT NULL,
  alert_type TEXT NOT NULL,
  cleared_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  cleared_by_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  UNIQUE (store_id, alert_key)
);
ALTER TABLE "operational_alert_acknowledgments" ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS "operational_alert_acknowledgments_store_cleared_idx"
  ON "operational_alert_acknowledgments" (store_id, cleared_at DESC);

-- Activity logs are legacy runtime-created records; make their schema migration-owned.
CREATE TABLE IF NOT EXISTS "inventory_activity_logs" (
  id BIGSERIAL PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  detail TEXT NOT NULL,
  performed_by_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  performed_by_name TEXT,
  terminal_id TEXT,
  expected_pack_quantity INTEGER,
  recorded_pack_quantity INTEGER,
  quantity_unit TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE "inventory_activity_logs" ADD COLUMN IF NOT EXISTS terminal_id TEXT;
ALTER TABLE "inventory_activity_logs" ADD COLUMN IF NOT EXISTS expected_pack_quantity INTEGER;
ALTER TABLE "inventory_activity_logs" ADD COLUMN IF NOT EXISTS recorded_pack_quantity INTEGER;
ALTER TABLE "inventory_activity_logs" ADD COLUMN IF NOT EXISTS quantity_unit TEXT;
ALTER TABLE "inventory_activity_logs" ADD COLUMN IF NOT EXISTS resolved BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "inventory_activity_logs" ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
ALTER TABLE "inventory_activity_logs" ADD COLUMN IF NOT EXISTS resolved_by_id TEXT;
ALTER TABLE "inventory_activity_logs" ADD COLUMN IF NOT EXISTS resolved_by_name TEXT;
CREATE INDEX IF NOT EXISTS "inventory_activity_logs_store_created_idx"
  ON "inventory_activity_logs" (store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS "inventory_activity_logs_unresolved_idx"
  ON "inventory_activity_logs" (store_id, resolved, created_at DESC);

-- Keep corrections durable and migration-owned as well.
CREATE TABLE IF NOT EXISTS "inventory_correction_logs" (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT NOT NULL,
  reason TEXT NOT NULL,
  corrected_by_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  corrected_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "inventory_correction_logs_store_created_idx"
  ON "inventory_correction_logs" (store_id, created_at DESC);

-- An event key allows repeated alert types for the same pack to remain distinct.
CREATE TABLE IF NOT EXISTS "inventory_notifications" (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  event_key TEXT NOT NULL,
  pack_id TEXT REFERENCES packs(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  detail TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'HIGH',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE "inventory_notifications" ADD COLUMN IF NOT EXISTS event_key TEXT;
ALTER TABLE "inventory_notifications" ADD COLUMN IF NOT EXISTS pack_id TEXT REFERENCES packs(id) ON DELETE SET NULL;
UPDATE "inventory_notifications" SET event_key = entity_id WHERE event_key IS NULL;
ALTER TABLE "inventory_notifications" ALTER COLUMN event_key SET NOT NULL;
UPDATE "inventory_notifications" AS n
SET pack_id = p.id
FROM packs AS p
WHERE n.pack_id IS NULL AND n.entity_id = p.id;
UPDATE "inventory_notifications" AS n
SET pack_id = line."packId"
FROM inventory_audit_lines AS line
WHERE n.pack_id IS NULL AND n.entity_id = line.id;
DO $$
DECLARE legacy_constraint RECORD;
BEGIN
  FOR legacy_constraint IN
    SELECT constraint_row.conname
    FROM pg_constraint AS constraint_row
    WHERE constraint_row.conrelid = 'inventory_notifications'::regclass
      AND constraint_row.contype = 'u'
      AND (
        SELECT array_agg(attribute_row.attname::text ORDER BY attribute_row.attname::text)
        FROM unnest(constraint_row.conkey) AS key_row(attnum)
        JOIN pg_attribute AS attribute_row
          ON attribute_row.attrelid = constraint_row.conrelid
         AND attribute_row.attnum = key_row.attnum
      ) = ARRAY['entity_id', 'notification_type', 'store_id']::text[]
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', 'inventory_notifications'::regclass, legacy_constraint.conname);
  END LOOP;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_notifications_store_type_event_key_idx"
  ON "inventory_notifications" (store_id, notification_type, event_key);
CREATE INDEX IF NOT EXISTS "inventory_notifications_store_created_idx"
  ON "inventory_notifications" (store_id, created_at DESC);

-- Provenance is explicit: automatic baseline values are not represented as physical scans.
ALTER TABLE "inventory_audit_lines"
  ADD COLUMN IF NOT EXISTS beginning_source TEXT NOT NULL DEFAULT 'AWAITING_PHYSICAL_SCAN';
ALTER TABLE "inventory_audit_lines"
  ALTER COLUMN beginning_source SET DEFAULT 'AWAITING_PHYSICAL_SCAN';
UPDATE "inventory_audit_lines"
SET beginning_source = 'PHYSICAL_SCAN'
WHERE beginning_source = 'AWAITING_PHYSICAL_SCAN' AND "beginningPhysicalTicket" IS NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'inventory_audit_lines_beginning_source_check'
  ) THEN
    ALTER TABLE "inventory_audit_lines"
      ADD CONSTRAINT "inventory_audit_lines_beginning_source_check"
      CHECK (beginning_source IN ('AWAITING_PHYSICAL_SCAN', 'PHYSICAL_SCAN', 'ACTIVATION_SNAPSHOT'));
  END IF;
END $$;
