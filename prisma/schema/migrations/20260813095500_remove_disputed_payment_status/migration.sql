-- AlterEnum
BEGIN;
CREATE TYPE "NotificationType_new" AS ENUM ('ORDER_STATUS', 'PAYMENT_CONFIRMED', 'SHIPMENT_TRACKING', 'SYSTEM_ALERT', 'PROMOTION');
ALTER TABLE "public"."notifications" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "notifications" ALTER COLUMN "type" TYPE "NotificationType_new" USING ("type"::text::"NotificationType_new");
ALTER TYPE "NotificationType" RENAME TO "NotificationType_old";
ALTER TYPE "NotificationType_new" RENAME TO "NotificationType";
DROP TYPE "public"."NotificationType_old";
ALTER TABLE "notifications" ALTER COLUMN "type" SET DEFAULT 'SYSTEM_ALERT';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "PaymentStatus_new" AS ENUM ('CREATED', 'PENDING', 'PROCESSING', 'WAITING_CONFIRMATION', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED', 'VOID', 'EXPIRED');
ALTER TABLE "public"."commerce_payment_attempts" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "public"."commerce_payments" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "commerce_payments" ALTER COLUMN "status" TYPE "PaymentStatus_new" USING ("status"::text::"PaymentStatus_new");
ALTER TABLE "commerce_payment_attempts" ALTER COLUMN "status" TYPE "PaymentStatus_new" USING ("status"::text::"PaymentStatus_new");
ALTER TABLE "commerce_payment_events" ALTER COLUMN "status" TYPE "PaymentStatus_new" USING ("status"::text::"PaymentStatus_new");
ALTER TYPE "PaymentStatus" RENAME TO "PaymentStatus_old";
ALTER TYPE "PaymentStatus_new" RENAME TO "PaymentStatus";
DROP TYPE "public"."PaymentStatus_old";
ALTER TABLE "commerce_payment_attempts" ALTER COLUMN "status" SET DEFAULT 'PENDING';
ALTER TABLE "commerce_payments" ALTER COLUMN "status" SET DEFAULT 'CREATED';
COMMIT;

