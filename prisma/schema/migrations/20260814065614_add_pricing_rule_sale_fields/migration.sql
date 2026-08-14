-- AlterTable
ALTER TABLE "catalog_pricing_rules" ADD COLUMN     "saleEndsAt" TIMESTAMP(3),
ADD COLUMN     "saleStartsAt" TIMESTAMP(3),
ADD COLUMN     "saleType" "MarkupType",
ADD COLUMN     "saleValue" DECIMAL(18,4);
