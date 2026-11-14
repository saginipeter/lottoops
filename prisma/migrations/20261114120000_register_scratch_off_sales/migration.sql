-- Keep historical drawer-cash fields for audit history; new shift closing records
-- the amount reported by the lottery register as a separate, nullable value.
ALTER TABLE "shifts"
  ADD COLUMN IF NOT EXISTS "registerScratchOffSales" DECIMAL(12, 2);

ALTER TABLE "shifts"
  ADD COLUMN IF NOT EXISTS "registerScratchOffSalesRecordedAt" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "registerScratchOffSalesRecordedById" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = '"shifts"'::regclass
      AND contype = 'f'
      AND conname = 'shifts_registerScratchOffSalesRecordedById_fkey'
  ) THEN
    ALTER TABLE "shifts"
      ADD CONSTRAINT "shifts_registerScratchOffSalesRecordedById_fkey"
      FOREIGN KEY ("registerScratchOffSalesRecordedById") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
