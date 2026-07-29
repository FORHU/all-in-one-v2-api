-- DropIndex
DROP INDEX "Cart_sessionId_key";

-- DropIndex
DROP INDEX "Category_slug_key";

-- DropIndex
DROP INDEX "Page_slug_key";

-- DropIndex
DROP INDEX "PricingRule_name_key";

-- DropIndex
DROP INDEX "Product_slug_key";

-- DropIndex
DROP INDEX "ProductVariant_sku_key";

-- AlterTable
ALTER TABLE "Announcement" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Banner" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Cart" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "FAQ" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Page" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "PricingRule" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "Announcement_tenantId_idx" ON "Announcement"("tenantId");

-- CreateIndex
CREATE INDEX "Banner_tenantId_idx" ON "Banner"("tenantId");

-- CreateIndex
CREATE INDEX "Cart_tenantId_idx" ON "Cart"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Cart_tenantId_customerId_key" ON "Cart"("tenantId", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "Cart_tenantId_sessionId_key" ON "Cart"("tenantId", "sessionId");

-- CreateIndex
CREATE INDEX "Category_tenantId_idx" ON "Category"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_tenantId_slug_key" ON "Category"("tenantId", "slug");

-- CreateIndex
CREATE INDEX "FAQ_tenantId_idx" ON "FAQ"("tenantId");

-- CreateIndex
CREATE INDEX "Order_tenantId_idx" ON "Order"("tenantId");

-- CreateIndex
CREATE INDEX "Page_tenantId_idx" ON "Page"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Page_tenantId_slug_key" ON "Page"("tenantId", "slug");

-- CreateIndex
CREATE INDEX "PricingRule_tenantId_idx" ON "PricingRule"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "PricingRule_tenantId_name_key" ON "PricingRule"("tenantId", "name");

-- CreateIndex
CREATE INDEX "Product_tenantId_idx" ON "Product"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_tenantId_slug_key" ON "Product"("tenantId", "slug");

-- CreateIndex
CREATE INDEX "ProductVariant_tenantId_idx" ON "ProductVariant"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_tenantId_sku_key" ON "ProductVariant"("tenantId", "sku");

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PricingRule" ADD CONSTRAINT "PricingRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Page" ADD CONSTRAINT "Page_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Banner" ADD CONSTRAINT "Banner_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FAQ" ADD CONSTRAINT "FAQ_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

