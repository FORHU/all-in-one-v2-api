-- DropForeignKey
ALTER TABLE "commerce_orders" DROP CONSTRAINT IF EXISTS "commerce_orders_customerId_fkey";
ALTER TABLE "commerce_orders" DROP CONSTRAINT IF EXISTS "commerce_orders_shippingAddressId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "commerce_customers_email_key";
DROP INDEX IF EXISTS "commerce_customers_userId_key";

-- AlterEnum
BEGIN;
CREATE TYPE "UserRole_new" AS ENUM ('USER', 'SUPER_ADMIN', 'DEVELOPER');
ALTER TABLE "auth_users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "auth_users" ALTER COLUMN "role" TYPE "UserRole_new" USING ("role"::text::"UserRole_new");
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
DROP TYPE "UserRole_old";
ALTER TABLE "auth_users" ALTER COLUMN "role" SET DEFAULT 'USER';
COMMIT;

-- AlterTable
ALTER TABLE "commerce_customers" ADD COLUMN "tenantId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "commerce_customers_tenantId_idx" ON "commerce_customers"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "commerce_customers_tenantId_userId_key" ON "commerce_customers"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "commerce_customers_tenantId_email_key" ON "commerce_customers"("tenantId", "email");

-- AddForeignKey
ALTER TABLE "commerce_customers" ADD CONSTRAINT "commerce_customers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce_orders" ADD CONSTRAINT "commerce_orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "commerce_customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce_orders" ADD CONSTRAINT "commerce_orders_shippingAddressId_fkey" FOREIGN KEY ("shippingAddressId") REFERENCES "commerce_shipping_addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

