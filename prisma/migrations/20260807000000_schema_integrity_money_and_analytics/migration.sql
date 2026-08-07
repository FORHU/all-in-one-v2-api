-- =============================================================================
-- Schema integrity, money precision, and analytics keying.
--
-- 1. Webhook idempotency  : commerce_webhook_events gains externalEventId with a
--                           UNIQUE(provider, externalEventId). Gateways retry on
--                           any non-2xx, so without this a retry is processed twice.
-- 2. Order money breakdown: subtotal / taxAmount / shippingAmount are stored
--                           alongside totalAmount, plus a human-readable
--                           orderNumber backed by a sequence (race-free under
--                           concurrent checkout).
-- 3. Money precision      : every monetary column standardises on DECIMAL(18,4).
--                           Two columns were bare Decimal, which Postgres had
--                           materialised as DECIMAL(65,30) -- cart prices carried
--                           30 decimal places while order items carried 2.
-- 4. Tenant isolation     : FKs that can cross a tenant boundary are rebuilt as
--                           composite (tenantId, id) references, so the database
--                           rejects cross-tenant rows rather than trusting every
--                           query to remember its WHERE clause.
--                           SetNull becomes Restrict on these: a composite FK can
--                           only null all of its columns, and tenantId is NOT NULL.
-- 5. Analytics keying     : analytics_product_sales is re-keyed to
--                           UNIQUE(tenantId, productId). The old
--                           UNIQUE(tenantId, productVariantId) was nullable, so
--                           Postgres let rollup rows duplicate without limit and
--                           Prisma could not express the upsert at all.
-- =============================================================================

-- Sequence backing commerce_orders.orderNumber. Must exist before the column
-- default below references it. OWNED BY ties its lifecycle to the column.
CREATE SEQUENCE IF NOT EXISTS "order_number_seq" AS BIGINT START WITH 1 INCREMENT BY 1;

-- DropForeignKey
ALTER TABLE "analytics_product_sales" DROP CONSTRAINT "analytics_product_sales_productVariantId_fkey";
-- DropForeignKey
ALTER TABLE "catalog_categories" DROP CONSTRAINT "catalog_categories_parentId_fkey";
-- DropForeignKey
ALTER TABLE "catalog_collections" DROP CONSTRAINT "catalog_collections_parentId_fkey";
-- DropForeignKey
ALTER TABLE "catalog_product_variants" DROP CONSTRAINT "catalog_product_variants_pricingRuleId_fkey";
-- DropForeignKey
ALTER TABLE "catalog_product_variants" DROP CONSTRAINT "catalog_product_variants_productId_fkey";
-- DropForeignKey
ALTER TABLE "catalog_products" DROP CONSTRAINT "catalog_products_categoryId_fkey";
-- DropForeignKey
ALTER TABLE "catalog_products" DROP CONSTRAINT "catalog_products_pricingRuleId_fkey";
-- DropForeignKey
ALTER TABLE "catalog_products" DROP CONSTRAINT "catalog_products_taxClassId_fkey";
-- DropForeignKey
ALTER TABLE "inventory_stocks" DROP CONSTRAINT "inventory_stocks_locationId_fkey";
-- DropForeignKey
ALTER TABLE "inventory_stocks" DROP CONSTRAINT "inventory_stocks_variantId_fkey";
-- DropForeignKey
ALTER TABLE "storefront_sections" DROP CONSTRAINT "storefront_sections_collectionId_fkey";
-- DropForeignKey
ALTER TABLE "storefront_sections" DROP CONSTRAINT "storefront_sections_pageId_fkey";
-- DropForeignKey
ALTER TABLE "tax_rates" DROP CONSTRAINT "tax_rates_taxClassId_fkey";
-- DropIndex
DROP INDEX "analytics_product_sales_tenantId_productVariantId_key";
-- AlterTable
ALTER TABLE "analytics_category_sales" ALTER COLUMN "totalRevenue" SET DATA TYPE DECIMAL(18,4);
-- AlterTable
ALTER TABLE "analytics_customers" ALTER COLUMN "lifetimeSpend" SET DATA TYPE DECIMAL(18,4),
ALTER COLUMN "avgOrderValue" SET DATA TYPE DECIMAL(18,4);
-- AlterTable
ALTER TABLE "analytics_daily_sales" ALTER COLUMN "revenueAmount" SET DATA TYPE DECIMAL(18,4);
-- AlterTable
ALTER TABLE "analytics_product_sales" DROP COLUMN "productVariantId",
ALTER COLUMN "totalRevenue" SET DATA TYPE DECIMAL(18,4);
-- AlterTable
ALTER TABLE "analytics_suppliers" ALTER COLUMN "totalRevenue" SET DATA TYPE DECIMAL(18,4);
-- AlterTable
ALTER TABLE "catalog_pricing_rules" ALTER COLUMN "markupValue" SET DATA TYPE DECIMAL(18,4),
ALTER COLUMN "minimumProfit" SET DATA TYPE DECIMAL(18,4);
-- AlterTable
ALTER TABLE "catalog_product_variants" ALTER COLUMN "price" SET DATA TYPE DECIMAL(18,4),
ALTER COLUMN "compareAtPrice" SET DATA TYPE DECIMAL(18,4),
ALTER COLUMN "baseCost" SET DATA TYPE DECIMAL(18,4),
ALTER COLUMN "sellingPrice" SET DATA TYPE DECIMAL(18,4),
ALTER COLUMN "calculatedPrice" SET DATA TYPE DECIMAL(18,4);
-- AlterTable
ALTER TABLE "catalog_products" ALTER COLUMN "price" SET DATA TYPE DECIMAL(18,4),
ALTER COLUMN "salePrice" SET DATA TYPE DECIMAL(18,4),
ALTER COLUMN "compareAtPrice" SET DATA TYPE DECIMAL(18,4);
-- AlterTable
ALTER TABLE "commerce_cart_items" ALTER COLUMN "unitPrice" SET DATA TYPE DECIMAL(18,4);
-- AlterTable
ALTER TABLE "commerce_order_items" ALTER COLUMN "unitPrice" SET DATA TYPE DECIMAL(18,4);
-- AlterTable
ALTER TABLE "commerce_orders" ADD COLUMN     "orderNumber" TEXT NOT NULL DEFAULT ('ORD-'::text || lpad((nextval('order_number_seq'::regclass))::text, 8, '0'::text)),
ADD COLUMN     "shippingAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
ADD COLUMN     "subtotal" DECIMAL(18,4) NOT NULL DEFAULT 0,
ADD COLUMN     "taxAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
ALTER COLUMN "totalAmount" SET DATA TYPE DECIMAL(18,4),
ALTER COLUMN "discountAmount" SET DATA TYPE DECIMAL(18,4);
-- AlterTable
ALTER TABLE "commerce_payment_attempts" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(18,4);
-- AlterTable
ALTER TABLE "commerce_payments" ALTER COLUMN "expectedAmount" SET DATA TYPE DECIMAL(18,4),
ALTER COLUMN "amount" SET DATA TYPE DECIMAL(18,4);
-- AlterTable
ALTER TABLE "commerce_webhook_events" ADD COLUMN     "externalEventId" TEXT NOT NULL;
-- AlterTable
ALTER TABLE "coupons" ALTER COLUMN "discountValue" SET DATA TYPE DECIMAL(18,4),
ALTER COLUMN "minOrderValue" SET DATA TYPE DECIMAL(18,4),
ALTER COLUMN "maxDiscount" SET DATA TYPE DECIMAL(18,4);
-- AlterTable
ALTER TABLE "marketing_social_ads" ALTER COLUMN "dailyBudget" SET DATA TYPE DECIMAL(18,4),
ALTER COLUMN "totalSpend" SET DATA TYPE DECIMAL(18,4),
ALTER COLUMN "revenueGenerated" SET DATA TYPE DECIMAL(18,4);
-- AlterTable
ALTER TABLE "promotion_rewards" ALTER COLUMN "value" SET DATA TYPE DECIMAL(18,4),
ALTER COLUMN "maxDiscount" SET DATA TYPE DECIMAL(18,4);
-- AlterTable
ALTER TABLE "refunds" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(18,4);
-- AlterTable
ALTER TABLE "supplier_products" ALTER COLUMN "costPrice" SET DATA TYPE DECIMAL(18,4),
ALTER COLUMN "retailPrice" SET DATA TYPE DECIMAL(18,4),
ALTER COLUMN "shippingEstimate" SET DATA TYPE DECIMAL(18,4);
-- AlterTable
ALTER TABLE "supplier_variants" ALTER COLUMN "costPrice" SET DATA TYPE DECIMAL(18,4),
ALTER COLUMN "retailPrice" SET DATA TYPE DECIMAL(18,4);
-- CreateIndex
CREATE UNIQUE INDEX "analytics_product_sales_tenantId_productId_key" ON "analytics_product_sales"("tenantId", "productId");
-- CreateIndex
CREATE UNIQUE INDEX "catalog_categories_tenantId_id_key" ON "catalog_categories"("tenantId", "id");
-- CreateIndex
CREATE UNIQUE INDEX "catalog_collections_tenantId_id_key" ON "catalog_collections"("tenantId", "id");
-- CreateIndex
CREATE UNIQUE INDEX "catalog_pricing_rules_tenantId_id_key" ON "catalog_pricing_rules"("tenantId", "id");
-- CreateIndex
CREATE UNIQUE INDEX "catalog_product_variants_tenantId_id_key" ON "catalog_product_variants"("tenantId", "id");
-- CreateIndex
CREATE UNIQUE INDEX "catalog_products_tenantId_id_key" ON "catalog_products"("tenantId", "id");
-- CreateIndex
CREATE UNIQUE INDEX "commerce_orders_tenantId_id_key" ON "commerce_orders"("tenantId", "id");
-- CreateIndex
CREATE UNIQUE INDEX "commerce_orders_tenantId_orderNumber_key" ON "commerce_orders"("tenantId", "orderNumber");
-- CreateIndex
CREATE INDEX "commerce_webhook_events_status_createdAt_idx" ON "commerce_webhook_events"("status", "createdAt");
-- CreateIndex
CREATE UNIQUE INDEX "commerce_webhook_events_provider_externalEventId_key" ON "commerce_webhook_events"("provider", "externalEventId");
-- CreateIndex
CREATE UNIQUE INDEX "inventory_locations_tenantId_id_key" ON "inventory_locations"("tenantId", "id");
-- CreateIndex
CREATE UNIQUE INDEX "storefront_pages_tenantId_id_key" ON "storefront_pages"("tenantId", "id");
-- CreateIndex
CREATE UNIQUE INDEX "tax_classes_tenantId_id_key" ON "tax_classes"("tenantId", "id");
-- AddForeignKey
ALTER TABLE "catalog_categories" ADD CONSTRAINT "catalog_categories_tenantId_parentId_fkey" FOREIGN KEY ("tenantId", "parentId") REFERENCES "catalog_categories"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "catalog_products" ADD CONSTRAINT "catalog_products_tenantId_categoryId_fkey" FOREIGN KEY ("tenantId", "categoryId") REFERENCES "catalog_categories"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "catalog_products" ADD CONSTRAINT "catalog_products_tenantId_pricingRuleId_fkey" FOREIGN KEY ("tenantId", "pricingRuleId") REFERENCES "catalog_pricing_rules"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "catalog_products" ADD CONSTRAINT "catalog_products_tenantId_taxClassId_fkey" FOREIGN KEY ("tenantId", "taxClassId") REFERENCES "tax_classes"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "catalog_product_variants" ADD CONSTRAINT "catalog_product_variants_tenantId_productId_fkey" FOREIGN KEY ("tenantId", "productId") REFERENCES "catalog_products"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "catalog_product_variants" ADD CONSTRAINT "catalog_product_variants_tenantId_pricingRuleId_fkey" FOREIGN KEY ("tenantId", "pricingRuleId") REFERENCES "catalog_pricing_rules"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "catalog_collections" ADD CONSTRAINT "catalog_collections_tenantId_parentId_fkey" FOREIGN KEY ("tenantId", "parentId") REFERENCES "catalog_collections"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "inventory_stocks" ADD CONSTRAINT "inventory_stocks_tenantId_variantId_fkey" FOREIGN KEY ("tenantId", "variantId") REFERENCES "catalog_product_variants"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "inventory_stocks" ADD CONSTRAINT "inventory_stocks_tenantId_locationId_fkey" FOREIGN KEY ("tenantId", "locationId") REFERENCES "inventory_locations"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "tax_rates" ADD CONSTRAINT "tax_rates_tenantId_taxClassId_fkey" FOREIGN KEY ("tenantId", "taxClassId") REFERENCES "tax_classes"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "storefront_sections" ADD CONSTRAINT "storefront_sections_tenantId_pageId_fkey" FOREIGN KEY ("tenantId", "pageId") REFERENCES "storefront_pages"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "storefront_sections" ADD CONSTRAINT "storefront_sections_tenantId_collectionId_fkey" FOREIGN KEY ("tenantId", "collectionId") REFERENCES "catalog_collections"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- nextval() is volatile, so the ADD COLUMN above rewrote the table and assigned
-- each pre-existing order its own number. Tie the sequence to the column now
-- that the column exists.
ALTER SEQUENCE "order_number_seq" OWNED BY "commerce_orders"."orderNumber";

-- Backfill the money breakdown for orders that predate these columns: their
-- totalAmount was the line-item sum with no tax or shipping applied.
UPDATE "commerce_orders" SET "subtotal" = "totalAmount" WHERE "subtotal" = 0 AND "totalAmount" <> 0;
