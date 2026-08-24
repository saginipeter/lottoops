CREATE TYPE "InventoryAuditStatus" AS ENUM ('OPEN', 'COMPLETED');

CREATE TABLE "inventory_audits" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "status" "InventoryAuditStatus" NOT NULL DEFAULT 'OPEN',
    "begunById" TEXT NOT NULL,
    "begunAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedById" TEXT,
    "endedAt" TIMESTAMP(3),
    CONSTRAINT "inventory_audits_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inventory_audit_lines" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "slotNumber" TEXT NOT NULL,
    "expectedTicket" INTEGER NOT NULL,
    "endingExpectedTicket" INTEGER,
    "beginningPhysicalTicket" INTEGER,
    "endingPhysicalTicket" INTEGER,
    "variance" INTEGER,
    "varianceReason" TEXT,
    CONSTRAINT "inventory_audit_lines_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "inventory_audits_shiftId_key" ON "inventory_audits"("shiftId");
CREATE INDEX "inventory_audits_storeId_status_idx" ON "inventory_audits"("storeId", "status");
CREATE UNIQUE INDEX "inventory_audit_lines_auditId_packId_key" ON "inventory_audit_lines"("auditId", "packId");
CREATE INDEX "inventory_audit_lines_packId_idx" ON "inventory_audit_lines"("packId");

ALTER TABLE "inventory_audits" ADD CONSTRAINT "inventory_audits_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_audits" ADD CONSTRAINT "inventory_audits_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_audits" ADD CONSTRAINT "inventory_audits_begunById_fkey" FOREIGN KEY ("begunById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_audits" ADD CONSTRAINT "inventory_audits_endedById_fkey" FOREIGN KEY ("endedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inventory_audit_lines" ADD CONSTRAINT "inventory_audit_lines_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "inventory_audits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_audit_lines" ADD CONSTRAINT "inventory_audit_lines_packId_fkey" FOREIGN KEY ("packId") REFERENCES "packs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
