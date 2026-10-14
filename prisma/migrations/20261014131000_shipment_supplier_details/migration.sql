ALTER TABLE "shipments"
ADD COLUMN "supplierName" TEXT,
ADD COLUMN "supplierDetails" TEXT,
ADD COLUMN "expectedInventoryCost" DECIMAL(10, 2);
