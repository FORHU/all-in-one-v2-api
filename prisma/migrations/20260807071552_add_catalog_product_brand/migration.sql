-- AlterTable
ALTER TABLE "catalog_products" ADD COLUMN     "brand" TEXT;

-- CreateIndex
CREATE INDEX "catalog_products_tenantId_brand_idx" ON "catalog_products"("tenantId", "brand");
