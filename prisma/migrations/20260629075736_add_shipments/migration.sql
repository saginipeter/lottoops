-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('IN_PROGRESS', 'RECEIVED');

-- AlterTable
ALTER TABLE "packs" ADD COLUMN     "shipmentId" TEXT;

-- CreateTable
CREATE TABLE "shipments" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "receivedById" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "invoicePhoto" TEXT,
    "expectedPacks" INTEGER NOT NULL,
    "scannedPacks" INTEGER NOT NULL DEFAULT 0,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shipments_storeId_idx" ON "shipments"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "shipments_storeId_invoiceNumber_key" ON "shipments"("storeId", "invoiceNumber");

-- CreateIndex
CREATE INDEX "packs_shipmentId_idx" ON "packs"("shipmentId");

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packs" ADD CONSTRAINT "packs_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
