-- AlterEnum
BEGIN;
CREATE TYPE "TenantRole_new" AS ENUM ('OWNER', 'ADMIN_MANAGER', 'ADMIN', 'MANAGER', 'SELLER', 'EDITOR', 'VIEWER');
ALTER TABLE "tenant_memberships" ALTER COLUMN "role" TYPE "TenantRole_new" USING ("role"::text::"TenantRole_new");
ALTER TYPE "TenantRole" RENAME TO "TenantRole_old";
ALTER TYPE "TenantRole_new" RENAME TO "TenantRole";
DROP TYPE "TenantRole_old";
COMMIT;
