-- CreateEnum
CREATE TYPE "BackstockRemovalReason" AS ENUM ('RETURNED', 'LOST', 'OTHER');

-- CreateEnum
CREATE TYPE "ActiveRemovalReason" AS ENUM ('STOLEN', 'RETURNED', 'REASSIGNED', 'OTHER');

-- AlterTable
ALTER TABLE "packs" ADD COLUMN     "activationReceiptPhoto" TEXT,
ADD COLUMN     "activeRemovalReason" "ActiveRemovalReason",
ADD COLUMN     "activeRemovalReasonAt" TIMESTAMP(3),
ADD COLUMN     "activeRemovalReasonText" TEXT,
ADD COLUMN     "reassignedToSlotId" TEXT,
ADD COLUMN     "removalReason" "BackstockRemovalReason",
ADD COLUMN     "removalReasonAt" TIMESTAMP(3),
ADD COLUMN     "removalReasonText" TEXT;
