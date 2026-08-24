ALTER TABLE "packs"
ADD COLUMN "sequenceLocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "sequenceLockExpectedTicket" INTEGER,
ADD COLUMN "sequenceLockScannedTicket" INTEGER,
ADD COLUMN "sequenceLockBarcode" TEXT,
ADD COLUMN "sequenceLockedAt" TIMESTAMP(3),
ADD COLUMN "sequenceLockedById" TEXT;

CREATE INDEX "packs_storeId_sequenceLocked_idx" ON "packs"("storeId", "sequenceLocked");