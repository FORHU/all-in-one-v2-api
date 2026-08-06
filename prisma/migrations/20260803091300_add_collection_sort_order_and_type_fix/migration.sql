/*
  Warnings:

  - Changed the type of `type` on the `catalog_collections` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "CollectionType" AS ENUM ('OUTFIT', 'LOOKBOOK', 'BUNDLE', 'ROUTINE', 'SETUP', 'ROOM_BUNDLE');

-- CreateEnum
CREATE TYPE "StorefrontPageType" AS ENUM ('HOME', 'CATEGORY', 'PRODUCT', 'STORE', 'BRAND', 'SEARCH', 'CAMPAIGN', 'CUSTOM');

-- CreateEnum
CREATE TYPE "StorefrontContextType" AS ENUM ('CATEGORY', 'STORE', 'BRAND', 'CAMPAIGN');

-- CreateEnum
CREATE TYPE "StorefrontSectionStrategy" AS ENUM ('MANUAL', 'COLLECTION', 'TRENDING', 'BEST_SELLERS', 'NEW_ARRIVALS', 'FLASH_SALE', 'FEATURED', 'RECOMMENDED');

-- AlterTable
-- Cast the existing `type` text column into the new enum instead of
-- dropping + recreating it — a bare drop/add loses every existing row's
-- value and then immediately fails the NOT NULL check on any non-empty
-- table (which is exactly what happened here: 3 seeded collections).
ALTER TABLE "catalog_collections" ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "catalog_collections" ALTER COLUMN "type" TYPE "CollectionType" USING ("type"::"CollectionType");

-- CreateTable
CREATE TABLE "storefront_pages" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "pageType" "StorefrontPageType" NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "layout" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "storefront_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storefront_sections" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "strategy" "StorefrontSectionStrategy" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "maxItems" INTEGER NOT NULL DEFAULT 20,
    "cacheMinutes" INTEGER,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "collectionId" TEXT,
    "contextType" "StorefrontContextType",
    "contextId" TEXT,

    CONSTRAINT "storefront_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storefront_section_items" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "storefront_section_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "storefront_pages_tenantId_pageType_idx" ON "storefront_pages"("tenantId", "pageType");

-- CreateIndex
CREATE INDEX "storefront_pages_tenantId_isPublished_idx" ON "storefront_pages"("tenantId", "isPublished");

-- CreateIndex
CREATE UNIQUE INDEX "storefront_pages_tenantId_slug_key" ON "storefront_pages"("tenantId", "slug");

-- CreateIndex
CREATE INDEX "storefront_sections_pageId_idx" ON "storefront_sections"("pageId");

-- CreateIndex
CREATE INDEX "storefront_sections_tenantId_strategy_idx" ON "storefront_sections"("tenantId", "strategy");

-- CreateIndex
CREATE INDEX "storefront_sections_tenantId_isEnabled_idx" ON "storefront_sections"("tenantId", "isEnabled");

-- CreateIndex
CREATE INDEX "storefront_sections_collectionId_idx" ON "storefront_sections"("collectionId");

-- CreateIndex
CREATE INDEX "storefront_sections_contextType_contextId_idx" ON "storefront_sections"("contextType", "contextId");

-- CreateIndex
CREATE UNIQUE INDEX "storefront_sections_tenantId_slug_key" ON "storefront_sections"("tenantId", "slug");

-- CreateIndex
CREATE INDEX "storefront_section_items_sectionId_position_idx" ON "storefront_section_items"("sectionId", "position");

-- CreateIndex
CREATE INDEX "storefront_section_items_productId_idx" ON "storefront_section_items"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "storefront_section_items_sectionId_productId_key" ON "storefront_section_items"("sectionId", "productId");

-- Note: "catalog_collections_tenantId_type_idx" already exists from the
-- init migration and survives here since ALTER COLUMN TYPE (unlike the
-- original DROP+ADD COLUMN) doesn't drop the column's dependent index.

-- AddForeignKey
ALTER TABLE "storefront_pages" ADD CONSTRAINT "storefront_pages_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storefront_sections" ADD CONSTRAINT "storefront_sections_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storefront_sections" ADD CONSTRAINT "storefront_sections_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "storefront_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storefront_sections" ADD CONSTRAINT "storefront_sections_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "catalog_collections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storefront_section_items" ADD CONSTRAINT "storefront_section_items_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "storefront_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storefront_section_items" ADD CONSTRAINT "storefront_section_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "catalog_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
