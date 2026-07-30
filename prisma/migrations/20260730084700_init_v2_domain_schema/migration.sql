-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN', 'SUPER_ADMIN', 'DEVELOPER');

-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'READY', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'GIF', 'VIDEO', 'AUDIO', 'DOCUMENT', 'ARCHIVE', 'OTHER');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PROCESSING', 'PARTIALLY_FULFILLED', 'FULFILLED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "SupplierOrderStatus" AS ENUM ('PENDING', 'PLACED', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('CREATED', 'PENDING', 'PROCESSING', 'WAITING_CONFIRMATION', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED', 'VOID', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('PENDING', 'LABEL_CREATED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'RETURNED');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'PAUSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LogLevel" AS ENUM ('INFO', 'WARN', 'ERROR', 'DEBUG');

-- CreateEnum
CREATE TYPE "MarkupType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "PageStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AdSocialPlatform" AS ENUM ('META', 'GOOGLE', 'TIKTOK', 'PINTEREST', 'CUSTOM');

-- CreateEnum
CREATE TYPE "AdSocialStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "InventoryTransactionType" AS ENUM ('PURCHASE', 'SALE', 'RETURN', 'SUPPLIER_SYNC', 'MANUAL_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('ORDER_STATUS', 'PAYMENT_CONFIRMED', 'SHIPMENT_TRACKING', 'SYSTEM_ALERT', 'PROMOTION');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING');

-- CreateEnum
CREATE TYPE "ReturnStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'RECEIVED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "PaymentGateway" AS ENUM ('PAYMONGO', 'STRIPE', 'PAYPAL', 'XENDIT', 'MAYA');

-- CreateEnum
CREATE TYPE "PaymentChannel" AS ENUM ('CARD', 'EWALLET', 'BANK_TRANSFER', 'QR', 'CASH_ON_DELIVERY');

-- CreateEnum
CREATE TYPE "PaymentInstrument" AS ENUM ('VISA', 'MASTERCARD', 'AMEX', 'GCASH', 'MAYA', 'BPI', 'BDO', 'METROBANK', 'QRPH');

-- CreateTable
CREATE TABLE "auth_users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "name" TEXT,
    "username" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "avatarId" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "isEmailVerified" BOOLEAN NOT NULL DEFAULT true,
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "auth_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "provider" TEXT,
    "providerAvatarUrl" TEXT,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_social_accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "providerUserId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "scopes" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_social_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_files" (
    "id" TEXT NOT NULL,
    "filename" TEXT,
    "fileUrl" TEXT,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "metaData" JSONB,

    CONSTRAINT "auth_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVE',
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_categories" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalog_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_products" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT,
    "description" TEXT,
    "tags" TEXT[],
    "status" "ProductStatus" NOT NULL DEFAULT 'DRAFT',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "salePrice" DECIMAL(65,30),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "categoryId" TEXT,
    "pricingRuleId" TEXT,

    CONSTRAINT "catalog_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_product_variants" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sku" TEXT,
    "title" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "baseCost" DECIMAL(12,2),
    "sellingPrice" DECIMAL(12,2),
    "calculatedPrice" DECIMAL(12,2),
    "stock" INTEGER NOT NULL DEFAULT 0,
    "attributes" JSONB,

    CONSTRAINT "catalog_product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_product_media" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productVariantId" TEXT,
    "fileId" TEXT,
    "url" TEXT NOT NULL,
    "type" "MediaType" NOT NULL DEFAULT 'IMAGE',
    "altText" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "catalog_product_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_partners" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_credentials" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "environment" TEXT NOT NULL DEFAULT 'production',
    "apiKey" TEXT,
    "apiSecret" TEXT,
    "accessToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "config" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_sync_logs" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "status" "SyncStatus" NOT NULL DEFAULT 'PENDING',
    "recordsProcessed" INTEGER NOT NULL DEFAULT 0,
    "details" JSONB,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "supplier_sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_products" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "productId" TEXT,
    "externalId" TEXT NOT NULL,
    "externalSku" TEXT,
    "rawData" JSONB NOT NULL,
    "costPrice" DECIMAL(65,30) NOT NULL,
    "shippingEstimate" DECIMAL(65,30),
    "syncStatus" "SyncStatus" NOT NULL DEFAULT 'PENDING',
    "lastSyncError" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_variants" (
    "id" TEXT NOT NULL,
    "supplierProductId" TEXT NOT NULL,
    "productVariantId" TEXT,
    "externalId" TEXT NOT NULL,
    "costPrice" DECIMAL(65,30) NOT NULL,
    "rawData" JSONB NOT NULL,
    "stock" INTEGER,
    "syncStatus" "SyncStatus" NOT NULL DEFAULT 'PENDING',
    "lastSyncError" TEXT,
    "lastSyncedAt" TIMESTAMP(3),

    CONSTRAINT "supplier_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commerce_customers" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commerce_customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commerce_shipping_addresses" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT,
    "postalCode" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "phone" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commerce_shipping_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commerce_carts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT,
    "sessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commerce_carts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commerce_cart_items" (
    "id" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "productVariantId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(65,30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commerce_cart_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commerce_orders" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "customerId" TEXT,
    "sessionId" TEXT,
    "shippingAddressId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commerce_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commerce_order_items" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productVariantId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(65,30) NOT NULL,
    "supplierOrderId" TEXT,

    CONSTRAINT "commerce_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commerce_supplier_orders" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "externalId" TEXT,
    "status" "SupplierOrderStatus" NOT NULL DEFAULT 'PENDING',
    "rawResponse" JSONB,
    "trackingNum" TEXT,
    "placedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commerce_supplier_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commerce_shipments" (
    "id" TEXT NOT NULL,
    "supplierOrderId" TEXT NOT NULL,
    "trackingNumber" TEXT,
    "carrier" TEXT,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'PENDING',
    "shippedAt" TIMESTAMP(3),
    "estimatedDelivery" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commerce_shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commerce_payments" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "gateway" "PaymentGateway" NOT NULL DEFAULT 'PAYMONGO',
    "channel" "PaymentChannel" NOT NULL DEFAULT 'CARD',
    "instrument" "PaymentInstrument",
    "expectedAmount" DECIMAL(18,2) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PHP',
    "status" "PaymentStatus" NOT NULL DEFAULT 'CREATED',
    "version" INTEGER NOT NULL DEFAULT 1,
    "idempotencyKey" TEXT,
    "gatewayTransactionId" TEXT,
    "gatewayPaymentId" TEXT,
    "gatewayResponse" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commerce_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commerce_payment_events" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL,
    "message" TEXT,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commerce_payment_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commerce_webhook_events" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "SyncStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commerce_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_logs" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "level" "LogLevel" NOT NULL DEFAULT 'INFO',
    "message" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "details" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_pricing_rules" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "markupType" "MarkupType" NOT NULL,
    "markupValue" DECIMAL(65,30) NOT NULL,
    "minimumProfit" DECIMAL(65,30),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalog_pricing_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_pages" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "PageStatus" NOT NULL DEFAULT 'DRAFT',
    "seoMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cms_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_page_sections" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cms_page_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_banners" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "linkUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cms_banners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_announcements" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "linkUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cms_announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_faqs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "category" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cms_faqs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_social_feeds" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "platform" "AdSocialPlatform" NOT NULL DEFAULT 'META',
    "feedUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketing_social_feeds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_social_ads" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "mediaFileId" TEXT,
    "mediaUrl" TEXT,
    "title" TEXT NOT NULL,
    "headline" TEXT,
    "description" TEXT,
    "platform" "AdSocialPlatform" NOT NULL DEFAULT 'META',
    "externalAdId" TEXT,
    "status" "AdSocialStatus" NOT NULL DEFAULT 'DRAFT',
    "adUrl" TEXT,
    "dailyBudget" DECIMAL(12,2),
    "totalSpend" DECIMAL(12,2) DEFAULT 0,
    "clicksCount" INTEGER NOT NULL DEFAULT 0,
    "conversionsCount" INTEGER NOT NULL DEFAULT 0,
    "revenueGenerated" DECIMAL(18,2) DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketing_social_ads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_shareable_links" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketing_shareable_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_transactions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productVariantId" TEXT NOT NULL,
    "type" "InventoryTransactionType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "previousStock" INTEGER NOT NULL,
    "newStock" INTEGER NOT NULL,
    "referenceId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL DEFAULT 'SYSTEM_ALERT',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_reviews" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "title" TEXT,
    "comment" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "merchantReply" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_images" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wishlists" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wishlists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wishlist_items" (
    "id" TEXT NOT NULL,
    "wishlistId" TEXT NOT NULL,
    "productVariantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wishlist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupons" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "discountType" "DiscountType" NOT NULL DEFAULT 'PERCENTAGE',
    "discountValue" DECIMAL(12,2) NOT NULL,
    "minOrderValue" DECIMAL(12,2),
    "maxDiscount" DECIMAL(12,2),
    "usageLimit" INTEGER,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "returns" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ReturnStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "returnId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT,
    "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
    "transactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commerce_payment_attempts" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "rawResponse" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commerce_payment_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_product_sales" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productVariantId" TEXT,
    "totalSold" INTEGER NOT NULL DEFAULT 0,
    "totalRevenue" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalOrders" INTEGER NOT NULL DEFAULT 0,
    "lastSoldAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "analytics_product_sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_category_sales" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "totalRevenue" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalOrders" INTEGER NOT NULL DEFAULT 0,
    "totalProductsSold" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "analytics_category_sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_suppliers" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "productsImported" INTEGER NOT NULL DEFAULT 0,
    "totalOrders" INTEGER NOT NULL DEFAULT 0,
    "totalRevenue" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "failedOrders" INTEGER NOT NULL DEFAULT 0,
    "avgDeliveryDays" DECIMAL(5,2),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "analytics_suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_customers" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "lifetimeSpend" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalOrders" INTEGER NOT NULL DEFAULT 0,
    "avgOrderValue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "lastOrderedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "analytics_customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_daily_sales" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "ordersCount" INTEGER NOT NULL DEFAULT 0,
    "revenueAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "bestSellingProductId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "analytics_daily_sales_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "auth_users_email_key" ON "auth_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "auth_users_username_key" ON "auth_users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "auth_sessions_refreshToken_key" ON "auth_sessions"("refreshToken");

-- CreateIndex
CREATE INDEX "auth_sessions_userId_idx" ON "auth_sessions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "auth_social_accounts_userId_platform_key" ON "auth_social_accounts"("userId", "platform");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_domain_key" ON "tenants"("domain");

-- CreateIndex
CREATE INDEX "catalog_categories_parentId_idx" ON "catalog_categories"("parentId");

-- CreateIndex
CREATE INDEX "catalog_categories_tenantId_idx" ON "catalog_categories"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_categories_tenantId_slug_key" ON "catalog_categories"("tenantId", "slug");

-- CreateIndex
CREATE INDEX "catalog_products_categoryId_idx" ON "catalog_products"("categoryId");

-- CreateIndex
CREATE INDEX "catalog_products_tenantId_idx" ON "catalog_products"("tenantId");

-- CreateIndex
CREATE INDEX "catalog_products_tenantId_status_idx" ON "catalog_products"("tenantId", "status");

-- CreateIndex
CREATE INDEX "catalog_products_tenantId_featured_idx" ON "catalog_products"("tenantId", "featured");

-- CreateIndex
CREATE INDEX "catalog_products_tenantId_createdAt_idx" ON "catalog_products"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_products_tenantId_slug_key" ON "catalog_products"("tenantId", "slug");

-- CreateIndex
CREATE INDEX "catalog_product_variants_productId_idx" ON "catalog_product_variants"("productId");

-- CreateIndex
CREATE INDEX "catalog_product_variants_tenantId_idx" ON "catalog_product_variants"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_product_variants_tenantId_sku_key" ON "catalog_product_variants"("tenantId", "sku");

-- CreateIndex
CREATE INDEX "catalog_product_media_productId_idx" ON "catalog_product_media"("productId");

-- CreateIndex
CREATE INDEX "catalog_product_media_productVariantId_idx" ON "catalog_product_media"("productVariantId");

-- CreateIndex
CREATE INDEX "catalog_product_media_fileId_idx" ON "catalog_product_media"("fileId");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_partners_name_key" ON "supplier_partners"("name");

-- CreateIndex
CREATE INDEX "supplier_credentials_supplierId_idx" ON "supplier_credentials"("supplierId");

-- CreateIndex
CREATE INDEX "supplier_sync_logs_supplierId_idx" ON "supplier_sync_logs"("supplierId");

-- CreateIndex
CREATE INDEX "supplier_products_supplierId_idx" ON "supplier_products"("supplierId");

-- CreateIndex
CREATE INDEX "supplier_products_productId_idx" ON "supplier_products"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_products_supplierId_externalId_key" ON "supplier_products"("supplierId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_variants_supplierProductId_externalId_key" ON "supplier_variants"("supplierProductId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "commerce_customers_userId_key" ON "commerce_customers"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "commerce_customers_email_key" ON "commerce_customers"("email");

-- CreateIndex
CREATE INDEX "commerce_shipping_addresses_customerId_idx" ON "commerce_shipping_addresses"("customerId");

-- CreateIndex
CREATE INDEX "commerce_carts_customerId_idx" ON "commerce_carts"("customerId");

-- CreateIndex
CREATE INDEX "commerce_carts_tenantId_idx" ON "commerce_carts"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "commerce_carts_tenantId_customerId_key" ON "commerce_carts"("tenantId", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "commerce_carts_tenantId_sessionId_key" ON "commerce_carts"("tenantId", "sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "commerce_cart_items_cartId_productVariantId_key" ON "commerce_cart_items"("cartId", "productVariantId");

-- CreateIndex
CREATE INDEX "commerce_orders_tenantId_idx" ON "commerce_orders"("tenantId");

-- CreateIndex
CREATE INDEX "commerce_orders_customerId_idx" ON "commerce_orders"("customerId");

-- CreateIndex
CREATE INDEX "commerce_orders_shippingAddressId_idx" ON "commerce_orders"("shippingAddressId");

-- CreateIndex
CREATE INDEX "commerce_orders_tenantId_status_idx" ON "commerce_orders"("tenantId", "status");

-- CreateIndex
CREATE INDEX "commerce_orders_tenantId_createdAt_idx" ON "commerce_orders"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "commerce_order_items_orderId_idx" ON "commerce_order_items"("orderId");

-- CreateIndex
CREATE INDEX "commerce_order_items_productVariantId_idx" ON "commerce_order_items"("productVariantId");

-- CreateIndex
CREATE INDEX "commerce_order_items_supplierOrderId_idx" ON "commerce_order_items"("supplierOrderId");

-- CreateIndex
CREATE INDEX "commerce_supplier_orders_orderId_idx" ON "commerce_supplier_orders"("orderId");

-- CreateIndex
CREATE INDEX "commerce_supplier_orders_supplierId_idx" ON "commerce_supplier_orders"("supplierId");

-- CreateIndex
CREATE INDEX "commerce_shipments_supplierOrderId_idx" ON "commerce_shipments"("supplierOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "commerce_payments_idempotencyKey_key" ON "commerce_payments"("idempotencyKey");

-- CreateIndex
CREATE INDEX "commerce_payments_orderId_idx" ON "commerce_payments"("orderId");

-- CreateIndex
CREATE INDEX "commerce_payments_status_idx" ON "commerce_payments"("status");

-- CreateIndex
CREATE INDEX "commerce_payments_gateway_idx" ON "commerce_payments"("gateway");

-- CreateIndex
CREATE INDEX "commerce_payments_createdAt_idx" ON "commerce_payments"("createdAt");

-- CreateIndex
CREATE INDEX "commerce_payments_gatewayTransactionId_idx" ON "commerce_payments"("gatewayTransactionId");

-- CreateIndex
CREATE INDEX "commerce_payment_events_paymentId_idx" ON "commerce_payment_events"("paymentId");

-- CreateIndex
CREATE INDEX "commerce_payment_events_createdAt_idx" ON "commerce_payment_events"("createdAt");

-- CreateIndex
CREATE INDEX "job_logs_jobId_idx" ON "job_logs"("jobId");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "catalog_pricing_rules_tenantId_idx" ON "catalog_pricing_rules"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_pricing_rules_tenantId_name_key" ON "catalog_pricing_rules"("tenantId", "name");

-- CreateIndex
CREATE INDEX "cms_pages_tenantId_idx" ON "cms_pages"("tenantId");

-- CreateIndex
CREATE INDEX "cms_pages_tenantId_status_idx" ON "cms_pages"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "cms_pages_tenantId_slug_key" ON "cms_pages"("tenantId", "slug");

-- CreateIndex
CREATE INDEX "cms_page_sections_pageId_idx" ON "cms_page_sections"("pageId");

-- CreateIndex
CREATE INDEX "cms_banners_tenantId_idx" ON "cms_banners"("tenantId");

-- CreateIndex
CREATE INDEX "cms_announcements_tenantId_idx" ON "cms_announcements"("tenantId");

-- CreateIndex
CREATE INDEX "cms_faqs_tenantId_idx" ON "cms_faqs"("tenantId");

-- CreateIndex
CREATE INDEX "marketing_social_feeds_tenantId_idx" ON "marketing_social_feeds"("tenantId");

-- CreateIndex
CREATE INDEX "marketing_social_ads_tenantId_idx" ON "marketing_social_ads"("tenantId");

-- CreateIndex
CREATE INDEX "marketing_social_ads_productId_idx" ON "marketing_social_ads"("productId");

-- CreateIndex
CREATE INDEX "marketing_social_ads_mediaFileId_idx" ON "marketing_social_ads"("mediaFileId");

-- CreateIndex
CREATE UNIQUE INDEX "marketing_shareable_links_code_key" ON "marketing_shareable_links"("code");

-- CreateIndex
CREATE INDEX "marketing_shareable_links_tenantId_idx" ON "marketing_shareable_links"("tenantId");

-- CreateIndex
CREATE INDEX "marketing_shareable_links_productId_idx" ON "marketing_shareable_links"("productId");

-- CreateIndex
CREATE INDEX "inventory_transactions_tenantId_idx" ON "inventory_transactions"("tenantId");

-- CreateIndex
CREATE INDEX "inventory_transactions_productVariantId_idx" ON "inventory_transactions"("productVariantId");

-- CreateIndex
CREATE INDEX "notifications_tenantId_idx" ON "notifications"("tenantId");

-- CreateIndex
CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");

-- CreateIndex
CREATE INDEX "product_reviews_tenantId_idx" ON "product_reviews"("tenantId");

-- CreateIndex
CREATE INDEX "product_reviews_productId_idx" ON "product_reviews"("productId");

-- CreateIndex
CREATE INDEX "product_reviews_customerId_idx" ON "product_reviews"("customerId");

-- CreateIndex
CREATE INDEX "review_images_reviewId_idx" ON "review_images"("reviewId");

-- CreateIndex
CREATE INDEX "wishlists_tenantId_idx" ON "wishlists"("tenantId");

-- CreateIndex
CREATE INDEX "wishlists_customerId_idx" ON "wishlists"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "wishlists_tenantId_customerId_key" ON "wishlists"("tenantId", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "wishlist_items_wishlistId_productVariantId_key" ON "wishlist_items"("wishlistId", "productVariantId");

-- CreateIndex
CREATE INDEX "coupons_tenantId_idx" ON "coupons"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "coupons_tenantId_code_key" ON "coupons"("tenantId", "code");

-- CreateIndex
CREATE INDEX "returns_tenantId_idx" ON "returns"("tenantId");

-- CreateIndex
CREATE INDEX "returns_orderId_idx" ON "returns"("orderId");

-- CreateIndex
CREATE INDEX "returns_customerId_idx" ON "returns"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "refunds_returnId_key" ON "refunds"("returnId");

-- CreateIndex
CREATE UNIQUE INDEX "refunds_transactionId_key" ON "refunds"("transactionId");

-- CreateIndex
CREATE INDEX "refunds_tenantId_idx" ON "refunds"("tenantId");

-- CreateIndex
CREATE INDEX "refunds_orderId_idx" ON "refunds"("orderId");

-- CreateIndex
CREATE INDEX "commerce_payment_attempts_paymentId_idx" ON "commerce_payment_attempts"("paymentId");

-- CreateIndex
CREATE INDEX "analytics_product_sales_tenantId_idx" ON "analytics_product_sales"("tenantId");

-- CreateIndex
CREATE INDEX "analytics_product_sales_productId_idx" ON "analytics_product_sales"("productId");

-- CreateIndex
CREATE INDEX "analytics_product_sales_tenantId_totalSold_idx" ON "analytics_product_sales"("tenantId", "totalSold");

-- CreateIndex
CREATE UNIQUE INDEX "analytics_product_sales_tenantId_productVariantId_key" ON "analytics_product_sales"("tenantId", "productVariantId");

-- CreateIndex
CREATE INDEX "analytics_category_sales_tenantId_idx" ON "analytics_category_sales"("tenantId");

-- CreateIndex
CREATE INDEX "analytics_category_sales_categoryId_idx" ON "analytics_category_sales"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "analytics_category_sales_tenantId_categoryId_key" ON "analytics_category_sales"("tenantId", "categoryId");

-- CreateIndex
CREATE INDEX "analytics_suppliers_tenantId_idx" ON "analytics_suppliers"("tenantId");

-- CreateIndex
CREATE INDEX "analytics_suppliers_supplierId_idx" ON "analytics_suppliers"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "analytics_suppliers_tenantId_supplierId_key" ON "analytics_suppliers"("tenantId", "supplierId");

-- CreateIndex
CREATE INDEX "analytics_customers_tenantId_idx" ON "analytics_customers"("tenantId");

-- CreateIndex
CREATE INDEX "analytics_customers_customerId_idx" ON "analytics_customers"("customerId");

-- CreateIndex
CREATE INDEX "analytics_customers_tenantId_lifetimeSpend_idx" ON "analytics_customers"("tenantId", "lifetimeSpend");

-- CreateIndex
CREATE UNIQUE INDEX "analytics_customers_tenantId_customerId_key" ON "analytics_customers"("tenantId", "customerId");

-- CreateIndex
CREATE INDEX "analytics_daily_sales_tenantId_idx" ON "analytics_daily_sales"("tenantId");

-- CreateIndex
CREATE INDEX "analytics_daily_sales_tenantId_date_idx" ON "analytics_daily_sales"("tenantId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "analytics_daily_sales_tenantId_date_key" ON "analytics_daily_sales"("tenantId", "date");

-- AddForeignKey
ALTER TABLE "auth_users" ADD CONSTRAINT "auth_users_avatarId_fkey" FOREIGN KEY ("avatarId") REFERENCES "auth_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_social_accounts" ADD CONSTRAINT "auth_social_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_categories" ADD CONSTRAINT "catalog_categories_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_categories" ADD CONSTRAINT "catalog_categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "catalog_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_products" ADD CONSTRAINT "catalog_products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "catalog_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_products" ADD CONSTRAINT "catalog_products_pricingRuleId_fkey" FOREIGN KEY ("pricingRuleId") REFERENCES "catalog_pricing_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_products" ADD CONSTRAINT "catalog_products_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_product_variants" ADD CONSTRAINT "catalog_product_variants_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_product_variants" ADD CONSTRAINT "catalog_product_variants_productId_fkey" FOREIGN KEY ("productId") REFERENCES "catalog_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_product_media" ADD CONSTRAINT "catalog_product_media_productId_fkey" FOREIGN KEY ("productId") REFERENCES "catalog_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_product_media" ADD CONSTRAINT "catalog_product_media_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "catalog_product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_product_media" ADD CONSTRAINT "catalog_product_media_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "auth_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_credentials" ADD CONSTRAINT "supplier_credentials_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "supplier_partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_sync_logs" ADD CONSTRAINT "supplier_sync_logs_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "supplier_partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_products" ADD CONSTRAINT "supplier_products_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "supplier_partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_products" ADD CONSTRAINT "supplier_products_productId_fkey" FOREIGN KEY ("productId") REFERENCES "catalog_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_variants" ADD CONSTRAINT "supplier_variants_supplierProductId_fkey" FOREIGN KEY ("supplierProductId") REFERENCES "supplier_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_variants" ADD CONSTRAINT "supplier_variants_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "catalog_product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce_customers" ADD CONSTRAINT "commerce_customers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce_shipping_addresses" ADD CONSTRAINT "commerce_shipping_addresses_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "commerce_customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce_carts" ADD CONSTRAINT "commerce_carts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce_carts" ADD CONSTRAINT "commerce_carts_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "commerce_customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce_cart_items" ADD CONSTRAINT "commerce_cart_items_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "commerce_carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce_cart_items" ADD CONSTRAINT "commerce_cart_items_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "catalog_product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce_orders" ADD CONSTRAINT "commerce_orders_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce_orders" ADD CONSTRAINT "commerce_orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "commerce_customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce_orders" ADD CONSTRAINT "commerce_orders_shippingAddressId_fkey" FOREIGN KEY ("shippingAddressId") REFERENCES "commerce_shipping_addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce_order_items" ADD CONSTRAINT "commerce_order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "commerce_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce_order_items" ADD CONSTRAINT "commerce_order_items_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "catalog_product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce_order_items" ADD CONSTRAINT "commerce_order_items_supplierOrderId_fkey" FOREIGN KEY ("supplierOrderId") REFERENCES "commerce_supplier_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce_supplier_orders" ADD CONSTRAINT "commerce_supplier_orders_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "commerce_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce_supplier_orders" ADD CONSTRAINT "commerce_supplier_orders_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "supplier_partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce_shipments" ADD CONSTRAINT "commerce_shipments_supplierOrderId_fkey" FOREIGN KEY ("supplierOrderId") REFERENCES "commerce_supplier_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce_payments" ADD CONSTRAINT "commerce_payments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "commerce_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce_payment_events" ADD CONSTRAINT "commerce_payment_events_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "commerce_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_logs" ADD CONSTRAINT "job_logs_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_pricing_rules" ADD CONSTRAINT "catalog_pricing_rules_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_pages" ADD CONSTRAINT "cms_pages_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_page_sections" ADD CONSTRAINT "cms_page_sections_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "cms_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_banners" ADD CONSTRAINT "cms_banners_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_announcements" ADD CONSTRAINT "cms_announcements_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_faqs" ADD CONSTRAINT "cms_faqs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_social_feeds" ADD CONSTRAINT "marketing_social_feeds_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_social_ads" ADD CONSTRAINT "marketing_social_ads_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_social_ads" ADD CONSTRAINT "marketing_social_ads_productId_fkey" FOREIGN KEY ("productId") REFERENCES "catalog_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_social_ads" ADD CONSTRAINT "marketing_social_ads_mediaFileId_fkey" FOREIGN KEY ("mediaFileId") REFERENCES "auth_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_shareable_links" ADD CONSTRAINT "marketing_shareable_links_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_shareable_links" ADD CONSTRAINT "marketing_shareable_links_productId_fkey" FOREIGN KEY ("productId") REFERENCES "catalog_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "catalog_product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_productId_fkey" FOREIGN KEY ("productId") REFERENCES "catalog_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "commerce_customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_images" ADD CONSTRAINT "review_images_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "product_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlists" ADD CONSTRAINT "wishlists_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlists" ADD CONSTRAINT "wishlists_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "commerce_customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_wishlistId_fkey" FOREIGN KEY ("wishlistId") REFERENCES "wishlists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "catalog_product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "returns" ADD CONSTRAINT "returns_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "returns" ADD CONSTRAINT "returns_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "commerce_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "returns" ADD CONSTRAINT "returns_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "commerce_customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "commerce_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "returns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce_payment_attempts" ADD CONSTRAINT "commerce_payment_attempts_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "commerce_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_product_sales" ADD CONSTRAINT "analytics_product_sales_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_product_sales" ADD CONSTRAINT "analytics_product_sales_productId_fkey" FOREIGN KEY ("productId") REFERENCES "catalog_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_product_sales" ADD CONSTRAINT "analytics_product_sales_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "catalog_product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_category_sales" ADD CONSTRAINT "analytics_category_sales_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_category_sales" ADD CONSTRAINT "analytics_category_sales_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "catalog_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_suppliers" ADD CONSTRAINT "analytics_suppliers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_suppliers" ADD CONSTRAINT "analytics_suppliers_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "supplier_partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_customers" ADD CONSTRAINT "analytics_customers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_customers" ADD CONSTRAINT "analytics_customers_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "commerce_customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_daily_sales" ADD CONSTRAINT "analytics_daily_sales_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
