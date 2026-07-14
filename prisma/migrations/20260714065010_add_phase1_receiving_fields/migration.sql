-- AlterEnum
ALTER TYPE "PackStatus" ADD VALUE 'COMPLETED';

-- AlterTable
ALTER TABLE "packs" ADD COLUMN     "activationNumber" TEXT,
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "firstOrLastTicket" TEXT,
ADD COLUMN     "lotNumber" TEXT,
ADD COLUMN     "packImage" TEXT;

-- AlterTable
ALTER TABLE "shipments" ADD COLUMN     "confirmationReceiptPhoto" TEXT,
ADD COLUMN     "shipmentConfirmationNumber" TEXT;
