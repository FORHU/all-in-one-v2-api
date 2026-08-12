-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN', 'SUPER_ADMIN', 'DEVELOPER', 'SELLER');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'READY', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProductVisibility" AS ENUM ('PUBLIC', 'PRIVATE', 'HIDDEN', 'MEMBERS_ONLY');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'GIF', 'VIDEO', 'AUDIO', 'DOCUMENT', 'ARCHIVE', 'OTHER');

-- CreateEnum
CREATE TYPE "MarkupType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');

-- CreateEnum
CREATE TYPE "CollectionType" AS ENUM ('OUTFIT', 'LOOKBOOK', 'BUNDLE', 'ROUTINE', 'SETUP', 'ROOM_BUNDLE');

-- CreateEnum
CREATE TYPE "AttributeType" AS ENUM ('SELECT', 'TEXT', 'NUMBER', 'BOOLEAN');

-- CreateEnum
CREATE TYPE "PageStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PROCESSING', 'PARTIALLY_FULFILLED', 'FULFILLED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "SupplierOrderStatus" AS ENUM ('PENDING', 'PLACED', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('CREATED', 'PENDING', 'PROCESSING', 'WAITING_CONFIRMATION', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED', 'VOID', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('PENDING', 'LABEL_CREATED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'RETURNED');

-- CreateEnum
CREATE TYPE "PaymentGateway" AS ENUM ('PAYMONGO', 'STRIPE', 'PAYPAL', 'XENDIT', 'MAYA');

-- CreateEnum
CREATE TYPE "PaymentChannel" AS ENUM ('CARD', 'EWALLET', 'BANK_TRANSFER', 'QR', 'CASH_ON_DELIVERY');

-- CreateEnum
CREATE TYPE "PaymentInstrument" AS ENUM ('VISA', 'MASTERCARD', 'AMEX', 'GCASH', 'MAYA', 'BPI', 'BDO', 'METROBANK', 'QRPH');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING');

-- CreateEnum
CREATE TYPE "ReturnStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'RECEIVED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "InventoryTransactionType" AS ENUM ('PURCHASE', 'SALE', 'RETURN', 'SUPPLIER_SYNC', 'MANUAL_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "InventoryReservationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'RELEASED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AdSocialPlatform" AS ENUM ('META', 'GOOGLE', 'TIKTOK', 'PINTEREST', 'CUSTOM');

-- CreateEnum
CREATE TYPE "AdSocialStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PromotionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SCHEDULED', 'EXPIRED', 'DISABLED');

-- CreateEnum
CREATE TYPE "StorefrontPageType" AS ENUM ('HOME', 'CATEGORY', 'PRODUCT', 'STORE', 'BRAND', 'SEARCH', 'CAMPAIGN', 'CUSTOM');

-- CreateEnum
CREATE TYPE "StorefrontContextType" AS ENUM ('CATEGORY', 'STORE', 'BRAND', 'CAMPAIGN');

-- CreateEnum
CREATE TYPE "StorefrontSectionStrategy" AS ENUM ('MANUAL', 'COLLECTION', 'TRENDING', 'BEST_SELLERS', 'NEW_ARRIVALS', 'FLASH_SALE', 'FEATURED', 'RECOMMENDED');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'PAUSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LogLevel" AS ENUM ('INFO', 'WARN', 'ERROR', 'DEBUG');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('ORDER_STATUS', 'PAYMENT_CONFIRMED', 'SHIPMENT_TRACKING', 'SYSTEM_ALERT', 'PROMOTION');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'SMS', 'PUSH');

-- CreateEnum
CREATE TYPE "TenantRole" AS ENUM ('OWNER', 'ADMIN', 'MANAGER', 'SELLER', 'EDITOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');

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
    "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "auth_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "provider" TEXT,
    "providerAvatarUrl" TEXT,
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "userAgent" TEXT,

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
CREATE TABLE "catalog_categories" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "parentId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalog_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_products" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "tags" TEXT[],
    "status" "ProductStatus" NOT NULL DEFAULT 'DRAFT',
    "visibility" "ProductVisibility" NOT NULL DEFAULT 'PUBLIC',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "brand" TEXT,
    "price" DECIMAL(18,4),
    "salePrice" DECIMAL(18,4),
    "compareAtPrice" DECIMAL(18,4),
    "discount" JSONB,
    "thumbnailUrl" TEXT,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "publishedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "categoryId" TEXT,
    "pricingRuleId" TEXT,
    "taxClassId" TEXT,

    CONSTRAINT "catalog_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_product_variants" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sku" TEXT,
    "title" TEXT NOT NULL,
    "price" DECIMAL(18,4) NOT NULL,
    "compareAtPrice" DECIMAL(18,4),
    "baseCost" DECIMAL(18,4),
    "sellingPrice" DECIMAL(18,4),
    "calculatedPrice" DECIMAL(18,4),
    "discount" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "deletedAt" TIMESTAMP(3),
    "attributes" JSONB,
    "sizeEntryId" TEXT,
    "pricingRuleId" TEXT,

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
CREATE TABLE "catalog_size_guides" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'CM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalog_size_guides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_size_entries" (
    "id" TEXT NOT NULL,
    "guideId" TEXT NOT NULL,
    "sizeLabel" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "chest" DECIMAL(12,2),
    "waist" DECIMAL(12,2),
    "hips" DECIMAL(12,2),
    "inseam" DECIMAL(12,2),
    "length" DECIMAL(12,2),
    "shoulder" DECIMAL(12,2),
    "sleeve" DECIMAL(12,2),
    "footLength" DECIMAL(12,2),
    "width" DECIMAL(12,2),
    "height" DECIMAL(12,2),
    "depth" DECIMAL(12,2),
    "screenSize" DECIMAL(12,2),
    "weight" DECIMAL(12,2),
    "weightUnit" TEXT,

    CONSTRAINT "catalog_size_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_pricing_rules" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "markupType" "MarkupType" NOT NULL,
    "markupValue" DECIMAL(18,4) NOT NULL,
    "minimumProfit" DECIMAL(18,4),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalog_pricing_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_collections" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "type" "CollectionType" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "imageFileId" TEXT,
    "imageUrl" TEXT,
    "metadata" JSONB,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "parentId" TEXT,
    "categoryId" TEXT,

    CONSTRAINT "catalog_collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_collection_items" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productVariantId" TEXT,
    "imageFileId" TEXT,
    "slot" TEXT,
    "imageUrl" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isOptional" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "catalog_collection_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_attributes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "AttributeType" NOT NULL DEFAULT 'SELECT',
    "isFilterable" BOOLEAN NOT NULL DEFAULT true,
    "isSearchable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalog_attributes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_attribute_values" (
    "id" TEXT NOT NULL,
    "attributeId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "swatchColor" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "catalog_attribute_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_variant_attributes" (
    "variantId" TEXT NOT NULL,
    "valueId" TEXT NOT NULL,

    CONSTRAINT "catalog_variant_attributes_pkey" PRIMARY KEY ("variantId","valueId")
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
    "collectionId" TEXT,

    CONSTRAINT "cms_page_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_banners" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "imageFileId" TEXT,
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
    "tenantId" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "productVariantId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(18,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commerce_cart_items_pkey" PRIMARY KEY ("id")
);

-- Create Sequence
CREATE SEQUENCE IF NOT EXISTS "order_number_seq" START 1;

-- CreateTable
CREATE TABLE "commerce_orders" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL DEFAULT ('ORD-'::text || lpad((nextval('order_number_seq'::regclass))::text, 8, '0'::text)),
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "subtotal" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "shippingAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(18,4) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "customerId" TEXT,
    "sessionId" TEXT,
    "shippingAddressId" TEXT,
    "couponId" TEXT,
    "promotionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "analyticsRecordedAt" TIMESTAMP(3),

    CONSTRAINT "commerce_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commerce_order_items" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productVariantId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(18,4) NOT NULL,
    "supplierOrderId" TEXT,
    "productTitle" TEXT NOT NULL DEFAULT 'Unknown Product',
    "variantTitle" TEXT,
    "sku" TEXT,
    "imageUrl" TEXT,
    "attributes" JSONB,
    "taxRate" DECIMAL(5,4),
    "supplierCost" DECIMAL(18,4),

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
    "gateway" "PaymentGateway",
    "channel" "PaymentChannel",
    "instrument" "PaymentInstrument",
    "expectedAmount" DECIMAL(18,4) NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
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
CREATE TABLE "commerce_payment_attempts" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "rawResponse" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commerce_payment_attempts_pkey" PRIMARY KEY ("id")
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
    "externalEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "SyncStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commerce_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupons" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "discountType" "DiscountType" NOT NULL DEFAULT 'PERCENTAGE',
    "discountValue" DECIMAL(18,4) NOT NULL,
    "minOrderValue" DECIMAL(18,4),
    "maxDiscount" DECIMAL(18,4),
    "usageLimit" INTEGER,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
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
    "amount" DECIMAL(18,4) NOT NULL,
    "reason" TEXT,
    "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
    "transactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

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
CREATE TABLE "inventory_locations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "address" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_reservations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "referenceId" TEXT,
    "quantity" INTEGER NOT NULL,
    "status" "InventoryReservationStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_stocks" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "onHand" INTEGER NOT NULL DEFAULT 0,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "available" INTEGER NOT NULL DEFAULT 0,
    "reorderPoint" INTEGER NOT NULL DEFAULT 5,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_stocks_pkey" PRIMARY KEY ("id")
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
    "dailyBudget" DECIMAL(18,4),
    "totalSpend" DECIMAL(18,4) DEFAULT 0,
    "clicksCount" INTEGER NOT NULL DEFAULT 0,
    "conversionsCount" INTEGER NOT NULL DEFAULT 0,
    "revenueGenerated" DECIMAL(18,4) DEFAULT 0,
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
CREATE TABLE "promotions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "status" "PromotionStatus" NOT NULL DEFAULT 'ACTIVE',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "usageLimit" INTEGER,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promotions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotion_rules" (
    "id" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "ruleType" TEXT NOT NULL,
    "condition" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promotion_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotion_rewards" (
    "id" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "rewardType" TEXT NOT NULL,
    "value" DECIMAL(18,4) NOT NULL,
    "maxDiscount" DECIMAL(18,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promotion_rewards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotion_targets" (
    "id" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promotion_targets_pkey" PRIMARY KEY ("id")
);

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
    "title" TEXT,
    "description" TEXT,
    "brand" TEXT,
    "thumbnailUrl" TEXT,
    "rawData" JSONB NOT NULL,
    "costPrice" DECIMAL(18,4) NOT NULL,
    "retailPrice" DECIMAL(18,4),
    "shippingEstimate" DECIMAL(18,4),
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
    "costPrice" DECIMAL(18,4) NOT NULL,
    "retailPrice" DECIMAL(18,4),
    "rawData" JSONB NOT NULL,
    "stock" INTEGER,
    "syncStatus" "SyncStatus" NOT NULL DEFAULT 'PENDING',
    "lastSyncError" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "title" TEXT,
    "thumbnailUrl" TEXT,
    "attributes" JSONB,

    CONSTRAINT "supplier_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_product_images" (
    "id" TEXT NOT NULL,
    "supplierProductId" TEXT NOT NULL,
    "fileId" TEXT,
    "url" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "altText" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "type" TEXT NOT NULL DEFAULT 'IMAGE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_product_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_variant_images" (
    "id" TEXT NOT NULL,
    "supplierVariantId" TEXT NOT NULL,
    "fileId" TEXT,
    "url" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "altText" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "type" TEXT NOT NULL DEFAULT 'IMAGE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_variant_images_pkey" PRIMARY KEY ("id")
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
    "beforeState" JSONB,
    "afterState" JSONB,
    "requestId" TEXT,
    "correlationId" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL DEFAULT 'SYSTEM_ALERT',
    "channel" "NotificationChannel" NOT NULL DEFAULT 'IN_APP',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
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
CREATE TABLE "analytics_product_sales" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "totalSold" INTEGER NOT NULL DEFAULT 0,
    "totalRevenue" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "totalOrders" INTEGER NOT NULL DEFAULT 0,
    "lastSoldAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "analytics_product_sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_category_sales" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "totalRevenue" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "totalOrders" INTEGER NOT NULL DEFAULT 0,
    "totalProductsSold" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
    "totalRevenue" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "failedOrders" INTEGER NOT NULL DEFAULT 0,
    "avgDeliveryDays" DECIMAL(5,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "analytics_suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_customers" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "lifetimeSpend" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "totalOrders" INTEGER NOT NULL DEFAULT 0,
    "avgOrderValue" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "lastOrderedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "analytics_customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_daily_sales" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "ordersCount" INTEGER NOT NULL DEFAULT 0,
    "revenueAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "bestSellingProductId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "analytics_daily_sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_memberships" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "TenantRole" NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_memberships_pkey" PRIMARY KEY ("id")
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

-- CreateIndex
CREATE UNIQUE INDEX "auth_users_email_key" ON "auth_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "auth_users_username_key" ON "auth_users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "auth_sessions_refreshTokenHash_key" ON "auth_sessions"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "auth_sessions_userId_idx" ON "auth_sessions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "auth_social_accounts_userId_platform_key" ON "auth_social_accounts"("userId", "platform");

-- CreateIndex
CREATE UNIQUE INDEX "auth_social_accounts_platform_providerUserId_key" ON "auth_social_accounts"("platform", "providerUserId");

-- CreateIndex
CREATE INDEX "catalog_categories_parentId_idx" ON "catalog_categories"("parentId");

-- CreateIndex
CREATE INDEX "catalog_categories_tenantId_idx" ON "catalog_categories"("tenantId");

-- CreateIndex
CREATE INDEX "catalog_categories_tenantId_deletedAt_idx" ON "catalog_categories"("tenantId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_categories_tenantId_slug_key" ON "catalog_categories"("tenantId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_categories_tenantId_id_key" ON "catalog_categories"("tenantId", "id");

-- CreateIndex
CREATE INDEX "catalog_products_categoryId_idx" ON "catalog_products"("categoryId");

-- CreateIndex
CREATE INDEX "catalog_products_tenantId_idx" ON "catalog_products"("tenantId");

-- CreateIndex
CREATE INDEX "catalog_products_tenantId_status_idx" ON "catalog_products"("tenantId", "status");

-- CreateIndex
CREATE INDEX "catalog_products_tenantId_featured_idx" ON "catalog_products"("tenantId", "featured");

-- CreateIndex
CREATE INDEX "catalog_products_tenantId_deletedAt_idx" ON "catalog_products"("tenantId", "deletedAt");

-- CreateIndex
CREATE INDEX "catalog_products_tenantId_brand_idx" ON "catalog_products"("tenantId", "brand");

-- CreateIndex
CREATE INDEX "catalog_products_taxClassId_idx" ON "catalog_products"("taxClassId");

-- CreateIndex
CREATE INDEX "catalog_products_tenantId_createdAt_idx" ON "catalog_products"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_products_tenantId_slug_key" ON "catalog_products"("tenantId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_products_tenantId_id_key" ON "catalog_products"("tenantId", "id");

-- CreateIndex
CREATE INDEX "catalog_product_variants_productId_idx" ON "catalog_product_variants"("productId");

-- CreateIndex
CREATE INDEX "catalog_product_variants_tenantId_idx" ON "catalog_product_variants"("tenantId");

-- CreateIndex
CREATE INDEX "catalog_product_variants_sizeEntryId_idx" ON "catalog_product_variants"("sizeEntryId");

-- CreateIndex
CREATE INDEX "catalog_product_variants_pricingRuleId_idx" ON "catalog_product_variants"("pricingRuleId");

-- CreateIndex
CREATE INDEX "catalog_product_variants_tenantId_deletedAt_idx" ON "catalog_product_variants"("tenantId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_product_variants_tenantId_sku_key" ON "catalog_product_variants"("tenantId", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_product_variants_tenantId_id_key" ON "catalog_product_variants"("tenantId", "id");

-- CreateIndex
CREATE INDEX "catalog_product_media_productId_idx" ON "catalog_product_media"("productId");

-- CreateIndex
CREATE INDEX "catalog_product_media_productVariantId_idx" ON "catalog_product_media"("productVariantId");

-- CreateIndex
CREATE INDEX "catalog_product_media_fileId_idx" ON "catalog_product_media"("fileId");

-- CreateIndex
CREATE INDEX "catalog_size_guides_productId_idx" ON "catalog_size_guides"("productId");

-- CreateIndex
CREATE INDEX "catalog_size_entries_guideId_position_idx" ON "catalog_size_entries"("guideId", "position");

-- CreateIndex
CREATE INDEX "catalog_pricing_rules_tenantId_idx" ON "catalog_pricing_rules"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_pricing_rules_tenantId_name_key" ON "catalog_pricing_rules"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_pricing_rules_tenantId_id_key" ON "catalog_pricing_rules"("tenantId", "id");

-- CreateIndex
CREATE INDEX "catalog_collections_tenantId_type_idx" ON "catalog_collections"("tenantId", "type");

-- CreateIndex
CREATE INDEX "catalog_collections_tenantId_isPublic_idx" ON "catalog_collections"("tenantId", "isPublic");

-- CreateIndex
CREATE INDEX "catalog_collections_tenantId_categoryId_idx" ON "catalog_collections"("tenantId", "categoryId");

-- CreateIndex
CREATE INDEX "catalog_collections_parentId_idx" ON "catalog_collections"("parentId");

-- CreateIndex
CREATE INDEX "catalog_collections_imageFileId_idx" ON "catalog_collections"("imageFileId");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_collections_tenantId_slug_key" ON "catalog_collections"("tenantId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_collections_tenantId_id_key" ON "catalog_collections"("tenantId", "id");

-- CreateIndex
CREATE INDEX "catalog_collection_items_collectionId_position_idx" ON "catalog_collection_items"("collectionId", "position");

-- CreateIndex
CREATE INDEX "catalog_collection_items_productId_idx" ON "catalog_collection_items"("productId");

-- CreateIndex
CREATE INDEX "catalog_collection_items_productVariantId_idx" ON "catalog_collection_items"("productVariantId");

-- CreateIndex
CREATE INDEX "catalog_collection_items_imageFileId_idx" ON "catalog_collection_items"("imageFileId");

-- CreateIndex
CREATE INDEX "catalog_attributes_tenantId_idx" ON "catalog_attributes"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_attributes_tenantId_code_key" ON "catalog_attributes"("tenantId", "code");

-- CreateIndex
CREATE INDEX "catalog_attribute_values_attributeId_idx" ON "catalog_attribute_values"("attributeId");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_attribute_values_attributeId_value_key" ON "catalog_attribute_values"("attributeId", "value");

-- CreateIndex
CREATE INDEX "catalog_variant_attributes_variantId_idx" ON "catalog_variant_attributes"("variantId");

-- CreateIndex
CREATE INDEX "catalog_variant_attributes_valueId_idx" ON "catalog_variant_attributes"("valueId");

-- CreateIndex
CREATE INDEX "cms_pages_tenantId_idx" ON "cms_pages"("tenantId");

-- CreateIndex
CREATE INDEX "cms_pages_tenantId_status_idx" ON "cms_pages"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "cms_pages_tenantId_slug_key" ON "cms_pages"("tenantId", "slug");

-- CreateIndex
CREATE INDEX "cms_page_sections_pageId_idx" ON "cms_page_sections"("pageId");

-- CreateIndex
CREATE INDEX "cms_page_sections_collectionId_idx" ON "cms_page_sections"("collectionId");

-- CreateIndex
CREATE INDEX "cms_banners_tenantId_idx" ON "cms_banners"("tenantId");

-- CreateIndex
CREATE INDEX "cms_banners_imageFileId_idx" ON "cms_banners"("imageFileId");

-- CreateIndex
CREATE INDEX "cms_announcements_tenantId_idx" ON "cms_announcements"("tenantId");

-- CreateIndex
CREATE INDEX "cms_faqs_tenantId_idx" ON "cms_faqs"("tenantId");

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
CREATE INDEX "commerce_cart_items_tenantId_idx" ON "commerce_cart_items"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "commerce_cart_items_cartId_productVariantId_key" ON "commerce_cart_items"("cartId", "productVariantId");

-- CreateIndex
CREATE INDEX "commerce_orders_tenantId_idx" ON "commerce_orders"("tenantId");

-- CreateIndex
CREATE INDEX "commerce_orders_customerId_idx" ON "commerce_orders"("customerId");

-- CreateIndex
CREATE INDEX "commerce_orders_shippingAddressId_idx" ON "commerce_orders"("shippingAddressId");

-- CreateIndex
CREATE INDEX "commerce_orders_couponId_idx" ON "commerce_orders"("couponId");

-- CreateIndex
CREATE INDEX "commerce_orders_promotionId_idx" ON "commerce_orders"("promotionId");

-- CreateIndex
CREATE INDEX "commerce_orders_tenantId_status_idx" ON "commerce_orders"("tenantId", "status");

-- CreateIndex
CREATE INDEX "commerce_orders_tenantId_createdAt_idx" ON "commerce_orders"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "commerce_orders_tenantId_id_key" ON "commerce_orders"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "commerce_orders_tenantId_orderNumber_key" ON "commerce_orders"("tenantId", "orderNumber");

-- CreateIndex
CREATE INDEX "commerce_order_items_tenantId_idx" ON "commerce_order_items"("tenantId");

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
CREATE INDEX "commerce_payment_attempts_paymentId_idx" ON "commerce_payment_attempts"("paymentId");

-- CreateIndex
CREATE INDEX "commerce_payment_events_paymentId_idx" ON "commerce_payment_events"("paymentId");

-- CreateIndex
CREATE INDEX "commerce_payment_events_createdAt_idx" ON "commerce_payment_events"("createdAt");

-- CreateIndex
CREATE INDEX "commerce_webhook_events_status_createdAt_idx" ON "commerce_webhook_events"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "commerce_webhook_events_provider_externalEventId_key" ON "commerce_webhook_events"("provider", "externalEventId");

-- CreateIndex
CREATE INDEX "coupons_tenantId_idx" ON "coupons"("tenantId");

-- CreateIndex
CREATE INDEX "coupons_tenantId_deletedAt_idx" ON "coupons"("tenantId", "deletedAt");

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
CREATE INDEX "tax_classes_tenantId_idx" ON "tax_classes"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "tax_classes_tenantId_code_key" ON "tax_classes"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "tax_classes_tenantId_id_key" ON "tax_classes"("tenantId", "id");

-- CreateIndex
CREATE INDEX "tax_rates_tenantId_idx" ON "tax_rates"("tenantId");

-- CreateIndex
CREATE INDEX "tax_rates_taxClassId_idx" ON "tax_rates"("taxClassId");

-- CreateIndex
CREATE INDEX "tax_rates_tenantId_country_state_idx" ON "tax_rates"("tenantId", "country", "state");

-- CreateIndex
CREATE INDEX "inventory_locations_tenantId_idx" ON "inventory_locations"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_locations_tenantId_code_key" ON "inventory_locations"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_locations_tenantId_id_key" ON "inventory_locations"("tenantId", "id");

-- CreateIndex
CREATE INDEX "inventory_reservations_tenantId_idx" ON "inventory_reservations"("tenantId");

-- CreateIndex
CREATE INDEX "inventory_reservations_variantId_idx" ON "inventory_reservations"("variantId");

-- CreateIndex
CREATE INDEX "inventory_reservations_locationId_idx" ON "inventory_reservations"("locationId");

-- CreateIndex
CREATE INDEX "inventory_reservations_referenceId_idx" ON "inventory_reservations"("referenceId");

-- CreateIndex
CREATE INDEX "inventory_reservations_expiresAt_idx" ON "inventory_reservations"("expiresAt");

-- CreateIndex
CREATE INDEX "inventory_stocks_tenantId_idx" ON "inventory_stocks"("tenantId");

-- CreateIndex
CREATE INDEX "inventory_stocks_variantId_idx" ON "inventory_stocks"("variantId");

-- CreateIndex
CREATE INDEX "inventory_stocks_locationId_idx" ON "inventory_stocks"("locationId");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_stocks_variantId_locationId_key" ON "inventory_stocks"("variantId", "locationId");

-- CreateIndex
CREATE INDEX "inventory_transactions_tenantId_idx" ON "inventory_transactions"("tenantId");

-- CreateIndex
CREATE INDEX "inventory_transactions_productVariantId_idx" ON "inventory_transactions"("productVariantId");

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
CREATE INDEX "promotions_tenantId_status_idx" ON "promotions"("tenantId", "status");

-- CreateIndex
CREATE INDEX "promotions_code_idx" ON "promotions"("code");

-- CreateIndex
CREATE INDEX "promotions_tenantId_deletedAt_idx" ON "promotions"("tenantId", "deletedAt");

-- CreateIndex
CREATE INDEX "promotion_rules_promotionId_idx" ON "promotion_rules"("promotionId");

-- CreateIndex
CREATE INDEX "promotion_rewards_promotionId_idx" ON "promotion_rewards"("promotionId");

-- CreateIndex
CREATE INDEX "promotion_targets_promotionId_targetType_targetId_idx" ON "promotion_targets"("promotionId", "targetType", "targetId");

-- CreateIndex
CREATE INDEX "storefront_pages_tenantId_pageType_idx" ON "storefront_pages"("tenantId", "pageType");

-- CreateIndex
CREATE INDEX "storefront_pages_tenantId_isPublished_idx" ON "storefront_pages"("tenantId", "isPublished");

-- CreateIndex
CREATE UNIQUE INDEX "storefront_pages_tenantId_slug_key" ON "storefront_pages"("tenantId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "storefront_pages_tenantId_id_key" ON "storefront_pages"("tenantId", "id");

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
CREATE INDEX "supplier_product_images_supplierProductId_position_idx" ON "supplier_product_images"("supplierProductId", "position");

-- CreateIndex
CREATE INDEX "supplier_product_images_supplierProductId_isPrimary_idx" ON "supplier_product_images"("supplierProductId", "isPrimary");

-- CreateIndex
CREATE INDEX "supplier_product_images_fileId_idx" ON "supplier_product_images"("fileId");

-- CreateIndex
CREATE INDEX "supplier_variant_images_supplierVariantId_position_idx" ON "supplier_variant_images"("supplierVariantId", "position");

-- CreateIndex
CREATE INDEX "supplier_variant_images_supplierVariantId_isPrimary_idx" ON "supplier_variant_images"("supplierVariantId", "isPrimary");

-- CreateIndex
CREATE INDEX "supplier_variant_images_fileId_idx" ON "supplier_variant_images"("fileId");

-- CreateIndex
CREATE INDEX "supplier_sync_jobs_tenantId_status_idx" ON "supplier_sync_jobs"("tenantId", "status");

-- CreateIndex
CREATE INDEX "supplier_sync_jobs_supplierId_idx" ON "supplier_sync_jobs"("supplierId");

-- CreateIndex
CREATE INDEX "supplier_sync_jobs_scheduledAt_idx" ON "supplier_sync_jobs"("scheduledAt");

-- CreateIndex
CREATE INDEX "job_logs_jobId_idx" ON "job_logs"("jobId");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entityId_idx" ON "audit_logs"("entity", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_requestId_idx" ON "audit_logs"("requestId");

-- CreateIndex
CREATE INDEX "notifications_tenantId_idx" ON "notifications"("tenantId");

-- CreateIndex
CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_idx" ON "notifications"("userId", "isRead");

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
CREATE INDEX "analytics_product_sales_tenantId_idx" ON "analytics_product_sales"("tenantId");

-- CreateIndex
CREATE INDEX "analytics_product_sales_productId_idx" ON "analytics_product_sales"("productId");

-- CreateIndex
CREATE INDEX "analytics_product_sales_tenantId_totalSold_idx" ON "analytics_product_sales"("tenantId", "totalSold");

-- CreateIndex
CREATE UNIQUE INDEX "analytics_product_sales_tenantId_productId_key" ON "analytics_product_sales"("tenantId", "productId");

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

-- CreateIndex
CREATE INDEX "tenant_memberships_tenantId_idx" ON "tenant_memberships"("tenantId");

-- CreateIndex
CREATE INDEX "tenant_memberships_userId_idx" ON "tenant_memberships"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_memberships_tenantId_userId_key" ON "tenant_memberships"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_domain_key" ON "tenants"("domain");

-- AddForeignKey
ALTER TABLE "auth_users" ADD CONSTRAINT "auth_users_avatarId_fkey" FOREIGN KEY ("avatarId") REFERENCES "auth_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_social_accounts" ADD CONSTRAINT "auth_social_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_categories" ADD CONSTRAINT "catalog_categories_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_categories" ADD CONSTRAINT "catalog_categories_tenantId_parentId_fkey" FOREIGN KEY ("tenantId", "parentId") REFERENCES "catalog_categories"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_products" ADD CONSTRAINT "catalog_products_tenantId_categoryId_fkey" FOREIGN KEY ("tenantId", "categoryId") REFERENCES "catalog_categories"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_products" ADD CONSTRAINT "catalog_products_tenantId_pricingRuleId_fkey" FOREIGN KEY ("tenantId", "pricingRuleId") REFERENCES "catalog_pricing_rules"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_products" ADD CONSTRAINT "catalog_products_tenantId_taxClassId_fkey" FOREIGN KEY ("tenantId", "taxClassId") REFERENCES "tax_classes"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_products" ADD CONSTRAINT "catalog_products_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_product_variants" ADD CONSTRAINT "catalog_product_variants_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_product_variants" ADD CONSTRAINT "catalog_product_variants_tenantId_productId_fkey" FOREIGN KEY ("tenantId", "productId") REFERENCES "catalog_products"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_product_variants" ADD CONSTRAINT "catalog_product_variants_sizeEntryId_fkey" FOREIGN KEY ("sizeEntryId") REFERENCES "catalog_size_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_product_variants" ADD CONSTRAINT "catalog_product_variants_tenantId_pricingRuleId_fkey" FOREIGN KEY ("tenantId", "pricingRuleId") REFERENCES "catalog_pricing_rules"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_product_media" ADD CONSTRAINT "catalog_product_media_productId_fkey" FOREIGN KEY ("productId") REFERENCES "catalog_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_product_media" ADD CONSTRAINT "catalog_product_media_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "catalog_product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_product_media" ADD CONSTRAINT "catalog_product_media_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "auth_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_size_guides" ADD CONSTRAINT "catalog_size_guides_productId_fkey" FOREIGN KEY ("productId") REFERENCES "catalog_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_size_entries" ADD CONSTRAINT "catalog_size_entries_guideId_fkey" FOREIGN KEY ("guideId") REFERENCES "catalog_size_guides"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_pricing_rules" ADD CONSTRAINT "catalog_pricing_rules_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_collections" ADD CONSTRAINT "catalog_collections_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_collections" ADD CONSTRAINT "catalog_collections_tenantId_categoryId_fkey" FOREIGN KEY ("tenantId", "categoryId") REFERENCES "catalog_categories"("tenantId", "id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_collections" ADD CONSTRAINT "catalog_collections_tenantId_parentId_fkey" FOREIGN KEY ("tenantId", "parentId") REFERENCES "catalog_collections"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_collections" ADD CONSTRAINT "catalog_collections_imageFileId_fkey" FOREIGN KEY ("imageFileId") REFERENCES "auth_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_collection_items" ADD CONSTRAINT "catalog_collection_items_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "catalog_collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_collection_items" ADD CONSTRAINT "catalog_collection_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "catalog_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_collection_items" ADD CONSTRAINT "catalog_collection_items_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "catalog_product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_collection_items" ADD CONSTRAINT "catalog_collection_items_imageFileId_fkey" FOREIGN KEY ("imageFileId") REFERENCES "auth_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_attributes" ADD CONSTRAINT "catalog_attributes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_attribute_values" ADD CONSTRAINT "catalog_attribute_values_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "catalog_attributes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_variant_attributes" ADD CONSTRAINT "catalog_variant_attributes_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "catalog_product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_variant_attributes" ADD CONSTRAINT "catalog_variant_attributes_valueId_fkey" FOREIGN KEY ("valueId") REFERENCES "catalog_attribute_values"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_pages" ADD CONSTRAINT "cms_pages_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_page_sections" ADD CONSTRAINT "cms_page_sections_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "cms_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_page_sections" ADD CONSTRAINT "cms_page_sections_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "catalog_collections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_banners" ADD CONSTRAINT "cms_banners_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_banners" ADD CONSTRAINT "cms_banners_imageFileId_fkey" FOREIGN KEY ("imageFileId") REFERENCES "auth_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_announcements" ADD CONSTRAINT "cms_announcements_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_faqs" ADD CONSTRAINT "cms_faqs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce_customers" ADD CONSTRAINT "commerce_customers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce_shipping_addresses" ADD CONSTRAINT "commerce_shipping_addresses_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "commerce_customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce_carts" ADD CONSTRAINT "commerce_carts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce_carts" ADD CONSTRAINT "commerce_carts_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "commerce_customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce_cart_items" ADD CONSTRAINT "commerce_cart_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce_cart_items" ADD CONSTRAINT "commerce_cart_items_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "commerce_carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce_cart_items" ADD CONSTRAINT "commerce_cart_items_tenantId_productVariantId_fkey" FOREIGN KEY ("tenantId", "productVariantId") REFERENCES "catalog_product_variants"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce_orders" ADD CONSTRAINT "commerce_orders_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce_orders" ADD CONSTRAINT "commerce_orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "commerce_customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce_orders" ADD CONSTRAINT "commerce_orders_shippingAddressId_fkey" FOREIGN KEY ("shippingAddressId") REFERENCES "commerce_shipping_addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce_orders" ADD CONSTRAINT "commerce_orders_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "coupons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce_orders" ADD CONSTRAINT "commerce_orders_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "promotions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce_order_items" ADD CONSTRAINT "commerce_order_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce_order_items" ADD CONSTRAINT "commerce_order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "commerce_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce_order_items" ADD CONSTRAINT "commerce_order_items_tenantId_productVariantId_fkey" FOREIGN KEY ("tenantId", "productVariantId") REFERENCES "catalog_product_variants"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

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
ALTER TABLE "commerce_payment_attempts" ADD CONSTRAINT "commerce_payment_attempts_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "commerce_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce_payment_events" ADD CONSTRAINT "commerce_payment_events_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "commerce_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE "tax_classes" ADD CONSTRAINT "tax_classes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_rates" ADD CONSTRAINT "tax_rates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_rates" ADD CONSTRAINT "tax_rates_tenantId_taxClassId_fkey" FOREIGN KEY ("tenantId", "taxClassId") REFERENCES "tax_classes"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_locations" ADD CONSTRAINT "inventory_locations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_tenantId_variantId_fkey" FOREIGN KEY ("tenantId", "variantId") REFERENCES "catalog_product_variants"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_tenantId_locationId_fkey" FOREIGN KEY ("tenantId", "locationId") REFERENCES "inventory_locations"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_stocks" ADD CONSTRAINT "inventory_stocks_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_stocks" ADD CONSTRAINT "inventory_stocks_tenantId_variantId_fkey" FOREIGN KEY ("tenantId", "variantId") REFERENCES "catalog_product_variants"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_stocks" ADD CONSTRAINT "inventory_stocks_tenantId_locationId_fkey" FOREIGN KEY ("tenantId", "locationId") REFERENCES "inventory_locations"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "catalog_product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_rules" ADD CONSTRAINT "promotion_rules_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "promotions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_rewards" ADD CONSTRAINT "promotion_rewards_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "promotions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_targets" ADD CONSTRAINT "promotion_targets_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "promotions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storefront_pages" ADD CONSTRAINT "storefront_pages_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storefront_sections" ADD CONSTRAINT "storefront_sections_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storefront_sections" ADD CONSTRAINT "storefront_sections_tenantId_pageId_fkey" FOREIGN KEY ("tenantId", "pageId") REFERENCES "storefront_pages"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storefront_sections" ADD CONSTRAINT "storefront_sections_tenantId_collectionId_fkey" FOREIGN KEY ("tenantId", "collectionId") REFERENCES "catalog_collections"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storefront_section_items" ADD CONSTRAINT "storefront_section_items_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "storefront_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storefront_section_items" ADD CONSTRAINT "storefront_section_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "catalog_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE "supplier_product_images" ADD CONSTRAINT "supplier_product_images_supplierProductId_fkey" FOREIGN KEY ("supplierProductId") REFERENCES "supplier_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_product_images" ADD CONSTRAINT "supplier_product_images_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "auth_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_variant_images" ADD CONSTRAINT "supplier_variant_images_supplierVariantId_fkey" FOREIGN KEY ("supplierVariantId") REFERENCES "supplier_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_variant_images" ADD CONSTRAINT "supplier_variant_images_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "auth_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_sync_jobs" ADD CONSTRAINT "supplier_sync_jobs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_sync_jobs" ADD CONSTRAINT "supplier_sync_jobs_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "supplier_partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_logs" ADD CONSTRAINT "job_logs_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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
ALTER TABLE "analytics_product_sales" ADD CONSTRAINT "analytics_product_sales_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_product_sales" ADD CONSTRAINT "analytics_product_sales_productId_fkey" FOREIGN KEY ("productId") REFERENCES "catalog_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
