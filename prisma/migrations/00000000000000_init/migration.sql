-- LottoOps initial schema
-- This was hand-written to mirror prisma/schema.prisma exactly, because this
-- sandbox's network policy blocks binaries.prisma.sh (where `prisma migrate dev`
-- downloads its engine). Once you run this locally with real network access,
-- run `npx prisma generate` to produce the matching type-safe client, and
-- `npx prisma migrate dev` going forward will manage new migrations normally.

-- ── Enums ────────────────────────────────────────────────────

CREATE TYPE "Role" AS ENUM ('MANAGER', 'CLERK', 'VIEWER');
CREATE TYPE "PackStatus" AS ENUM ('BACK_STOCK', 'ACTIVE', 'SOLD_OUT', 'RETURNED');
CREATE TYPE "ShiftStatus" AS ENUM ('OPEN', 'CLOSED');
CREATE TYPE "ScanAction" AS ENUM ('RECEIVED', 'ACTIVATED', 'SOLD_OUT', 'SHIFT_OPEN', 'SHIFT_CLOSE', 'RETURNED');

-- ── Stores ───────────────────────────────────────────────────

CREATE TABLE "stores" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/Chicago',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stores_pkey" PRIMARY KEY ("id")
);

-- ── Users ────────────────────────────────────────────────────

CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'CLERK',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" TIMESTAMP(3),
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "users_storeId_idx" ON "users"("storeId");

ALTER TABLE "users" ADD CONSTRAINT "users_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── Games ────────────────────────────────────────────────────

CREATE TABLE "games" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "gameNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "ticketsPerPack" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "games_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "games_storeId_gameNumber_key" ON "games"("storeId", "gameNumber");
CREATE INDEX "games_storeId_idx" ON "games"("storeId");

ALTER TABLE "games" ADD CONSTRAINT "games_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── Packs ────────────────────────────────────────────────────

CREATE TABLE "packs" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "status" "PackStatus" NOT NULL DEFAULT 'BACK_STOCK',
    "cost" DECIMAL(10,2) NOT NULL,
    "retailValue" DECIMAL(10,2) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedById" TEXT NOT NULL,
    "activatedAt" TIMESTAMP(3),
    "currentTicketNumber" INTEGER,
    "notes" TEXT,
    CONSTRAINT "packs_pkey" PRIMARY KEY ("id")
);

-- Enforces the spec's duplicate-serial check at the database level, scoped
-- per store so it holds even under concurrent writes from multiple clerks.
CREATE UNIQUE INDEX "packs_storeId_serialNumber_key" ON "packs"("storeId", "serialNumber");
CREATE INDEX "packs_storeId_status_idx" ON "packs"("storeId", "status");

ALTER TABLE "packs" ADD CONSTRAINT "packs_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "packs" ADD CONSTRAINT "packs_gameId_fkey"
    FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "packs" ADD CONSTRAINT "packs_receivedById_fkey"
    FOREIGN KEY ("receivedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── Display slots ────────────────────────────────────────────

CREATE TABLE "display_slots" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "slotNumber" TEXT NOT NULL,
    "packId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "display_slots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "display_slots_packId_key" ON "display_slots"("packId");
CREATE UNIQUE INDEX "display_slots_storeId_slotNumber_key" ON "display_slots"("storeId", "slotNumber");
CREATE INDEX "display_slots_storeId_idx" ON "display_slots"("storeId");

ALTER TABLE "display_slots" ADD CONSTRAINT "display_slots_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "display_slots" ADD CONSTRAINT "display_slots_packId_fkey"
    FOREIGN KEY ("packId") REFERENCES "packs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Shifts & reconciliation ──────────────────────────────────

CREATE TABLE "shifts" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "status" "ShiftStatus" NOT NULL DEFAULT 'OPEN',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openedById" TEXT NOT NULL,
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "shifts_storeId_status_idx" ON "shifts"("storeId", "status");

ALTER TABLE "shifts" ADD CONSTRAINT "shifts_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_openedById_fkey"
    FOREIGN KEY ("openedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_closedById_fkey"
    FOREIGN KEY ("closedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "shift_lines" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "slotNumber" TEXT NOT NULL,
    "beginningTicket" INTEGER NOT NULL,
    "endingTicket" INTEGER,
    "ticketsSold" INTEGER,
    "salesAmount" DECIMAL(10,2),
    CONSTRAINT "shift_lines_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "shift_lines_shiftId_packId_key" ON "shift_lines"("shiftId", "packId");
CREATE INDEX "shift_lines_shiftId_idx" ON "shift_lines"("shiftId");

ALTER TABLE "shift_lines" ADD CONSTRAINT "shift_lines_shiftId_fkey"
    FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "shift_lines" ADD CONSTRAINT "shift_lines_packId_fkey"
    FOREIGN KEY ("packId") REFERENCES "packs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── Scan log / audit trail ───────────────────────────────────

CREATE TABLE "scan_log_entries" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "action" "ScanAction" NOT NULL,
    "packId" TEXT,
    "performedById" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "scan_log_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "scan_log_entries_storeId_timestamp_idx" ON "scan_log_entries"("storeId", "timestamp");

ALTER TABLE "scan_log_entries" ADD CONSTRAINT "scan_log_entries_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "scan_log_entries" ADD CONSTRAINT "scan_log_entries_packId_fkey"
    FOREIGN KEY ("packId") REFERENCES "packs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "scan_log_entries" ADD CONSTRAINT "scan_log_entries_performedById_fkey"
    FOREIGN KEY ("performedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
