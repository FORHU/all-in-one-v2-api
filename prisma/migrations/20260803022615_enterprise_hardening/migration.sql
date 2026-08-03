/*
  Warnings:

  - You are about to alter the column `unitPrice` on the `commerce_order_items` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(18,2)`.

*/
-- CreateEnum
CREATE TYPE "ProductVisibility" AS ENUM ('PUBLIC', 'PRIVATE', 'HIDDEN', 'MEMBERS_ONLY');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'SMS', 'PUSH');

-- AlterTable
ALTER TABLE "analytics_category_sales" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "analytics_customers" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "avgOrderValue" SET DATA TYPE DECIMAL(18,2);

-- AlterTable
ALTER TABLE "analytics_daily_sales" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "analytics_product_sales" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "analytics_suppliers" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "afterState" JSONB,
ADD COLUMN     "beforeState" JSONB,
ADD COLUMN     "correlationId" TEXT,
ADD COLUMN     "requestId" TEXT;

-- AlterTable
ALTER TABLE "catalog_categories" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "seoDescription" TEXT,
ADD COLUMN     "seoTitle" TEXT,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "catalog_product_variants" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1,
ALTER COLUMN "price" SET DATA TYPE DECIMAL(18,2),
ALTER COLUMN "compareAtPrice" SET DATA TYPE DECIMAL(18,2),
ALTER COLUMN "baseCost" SET DATA TYPE DECIMAL(18,2),
ALTER COLUMN "sellingPrice" SET DATA TYPE DECIMAL(18,2),
ALTER COLUMN "calculatedPrice" SET DATA TYPE DECIMAL(18,2);

-- AlterTable
ALTER TABLE "catalog_products" ADD COLUMN     "createdBy" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "seoDescription" TEXT,
ADD COLUMN     "seoTitle" TEXT,
ADD COLUMN     "taxClassId" TEXT,
ADD COLUMN     "updatedBy" TEXT,
ADD COLUMN     "visibility" "ProductVisibility" NOT NULL DEFAULT 'PUBLIC',
ALTER COLUMN "price" SET DATA TYPE DECIMAL(18,2),
ALTER COLUMN "salePrice" SET DATA TYPE DECIMAL(18,2),
ALTER COLUMN "compareAtPrice" SET DATA TYPE DECIMAL(18,2);

-- AlterTable
ALTER TABLE "commerce_order_items" ADD COLUMN     "attributes" JSONB,
ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "productTitle" TEXT NOT NULL DEFAULT 'Unknown Product',
ADD COLUMN     "sku" TEXT,
ADD COLUMN     "variantTitle" TEXT,
ALTER COLUMN "unitPrice" SET DATA TYPE DECIMAL(18,2);

-- AlterTable
ALTER TABLE "commerce_orders" ADD COLUMN     "couponId" TEXT,
ADD COLUMN     "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "promotionId" TEXT;

-- AlterTable
ALTER TABLE "coupons" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ALTER COLUMN "discountValue" SET DATA TYPE DECIMAL(18,2),
ALTER COLUMN "minOrderValue" SET DATA TYPE DECIMAL(18,2),
ALTER COLUMN "maxDiscount" SET DATA TYPE DECIMAL(18,2);

-- AlterTable
ALTER TABLE "inventory_stocks" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "channel" "NotificationChannel" NOT NULL DEFAULT 'IN_APP',
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "readAt" TIMESTAMP(3),
ADD COLUMN     "sentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "promotions" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "tax_classes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_rates" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "taxClassId" TEXT,
    "name" TEXT NOT NULL,
    "rate" DECIMAL(5,4) NOT NULL,
    "country" TEXT NOT NULL,
    "state" TEXT,
    "postalCode" TEXT,
    "isCombined" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_sync_jobs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "status" "SyncStatus" NOT NULL DEFAULT 'PENDING',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "retries" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "lockOwner" TEXT,
    "payload" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_sync_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tax_classes_tenantId_idx" ON "tax_classes"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "tax_classes_tenantId_code_key" ON "tax_classes"("tenantId", "code");

-- CreateIndex
CREATE INDEX "tax_rates_tenantId_idx" ON "tax_rates"("tenantId");

-- CreateIndex
CREATE INDEX "tax_rates_taxClassId_idx" ON "tax_rates"("taxClassId");

-- CreateIndex
CREATE INDEX "tax_rates_tenantId_country_state_idx" ON "tax_rates"("tenantId", "country", "state");

-- CreateIndex
CREATE INDEX "supplier_sync_jobs_tenantId_status_idx" ON "supplier_sync_jobs"("tenantId", "status");

-- CreateIndex
CREATE INDEX "supplier_sync_jobs_supplierId_idx" ON "supplier_sync_jobs"("supplierId");

-- CreateIndex
CREATE INDEX "supplier_sync_jobs_scheduledAt_idx" ON "supplier_sync_jobs"("scheduledAt");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entityId_idx" ON "audit_logs"("entity", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_requestId_idx" ON "audit_logs"("requestId");

-- CreateIndex
CREATE INDEX "catalog_categories_tenantId_deletedAt_idx" ON "catalog_categories"("tenantId", "deletedAt");

-- CreateIndex
CREATE INDEX "catalog_product_variants_tenantId_deletedAt_idx" ON "catalog_product_variants"("tenantId", "deletedAt");

-- CreateIndex
CREATE INDEX "catalog_products_tenantId_deletedAt_idx" ON "catalog_products"("tenantId", "deletedAt");

-- CreateIndex
CREATE INDEX "catalog_products_taxClassId_idx" ON "catalog_products"("taxClassId");

-- CreateIndex
CREATE INDEX "commerce_orders_couponId_idx" ON "commerce_orders"("couponId");

-- CreateIndex
CREATE INDEX "commerce_orders_promotionId_idx" ON "commerce_orders"("promotionId");

-- CreateIndex
CREATE INDEX "coupons_tenantId_deletedAt_idx" ON "coupons"("tenantId", "deletedAt");

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_idx" ON "notifications"("userId", "isRead");

-- CreateIndex
CREATE INDEX "promotions_tenantId_deletedAt_idx" ON "promotions"("tenantId", "deletedAt");

-- AddForeignKey
ALTER TABLE "catalog_products" ADD CONSTRAINT "catalog_products_taxClassId_fkey" FOREIGN KEY ("taxClassId") REFERENCES "tax_classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce_orders" ADD CONSTRAINT "commerce_orders_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "coupons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce_orders" ADD CONSTRAINT "commerce_orders_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "promotions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_classes" ADD CONSTRAINT "tax_classes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_rates" ADD CONSTRAINT "tax_rates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_rates" ADD CONSTRAINT "tax_rates_taxClassId_fkey" FOREIGN KEY ("taxClassId") REFERENCES "tax_classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_sync_jobs" ADD CONSTRAINT "supplier_sync_jobs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_sync_jobs" ADD CONSTRAINT "supplier_sync_jobs_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "supplier_partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
