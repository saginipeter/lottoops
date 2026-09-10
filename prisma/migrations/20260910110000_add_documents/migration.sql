CREATE TABLE "documents" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "uploadedById" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "reference" TEXT,
  "documentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "retentionUntil" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "packId" TEXT,
  "shipmentId" TEXT,
  CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "documents_storeId_documentDate_idx" ON "documents"("storeId", "documentDate");
CREATE INDEX "documents_storeId_type_idx" ON "documents"("storeId", "type");
CREATE INDEX "documents_packId_idx" ON "documents"("packId");
CREATE INDEX "documents_shipmentId_idx" ON "documents"("shipmentId");
ALTER TABLE "documents" ADD CONSTRAINT "documents_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "documents" ADD CONSTRAINT "documents_packId_fkey" FOREIGN KEY ("packId") REFERENCES "packs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "documents" ADD CONSTRAINT "documents_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE SET NULL ON UPDATE CASCADE;