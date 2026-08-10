-- AlterTable
ALTER TABLE "catalog_collections" ADD COLUMN     "categoryId" TEXT;

-- CreateIndex
CREATE INDEX "catalog_collections_tenantId_categoryId_idx" ON "catalog_collections"("tenantId", "categoryId");

-- AddForeignKey
ALTER TABLE "catalog_collections" ADD CONSTRAINT "catalog_collections_tenantId_categoryId_fkey" FOREIGN KEY ("tenantId", "categoryId") REFERENCES "catalog_categories"("tenantId", "id") ON DELETE SET NULL ON UPDATE CASCADE;
