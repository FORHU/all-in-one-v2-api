-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "sessionId" TEXT;

-- CreateIndex
CREATE INDEX "Order_sessionId_idx" ON "Order"("sessionId");

