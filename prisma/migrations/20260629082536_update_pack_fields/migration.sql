-- AlterTable
ALTER TABLE "packs" ADD COLUMN     "activationReceipt" TEXT,
ADD COLUMN     "firstTicket" INTEGER,
ADD COLUMN     "gameNumber" TEXT,
ADD COLUMN     "invoiceReceipt" TEXT,
ADD COLUMN     "packNumber" TEXT,
ADD COLUMN     "ticketPrice" DECIMAL(10,2),
ADD COLUMN     "ticketQuantity" INTEGER;
