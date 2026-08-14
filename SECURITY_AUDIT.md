# Security & Architecture Audit Report

This document outlines the security and architectural hardening items for the codebase, tracking completed fixes and remaining tasks.

---

## ✅ Completed Fixes

### 1. Refresh Token Rotation & Session Security

- **Status**: Completed
- **Implementation**: Single-use refresh tokens with automatic family rotation and reuse detection. If a compromised refresh token is replayed, the entire session family is revoked instantly.

### 2. Tenant-Scoped Customers & Schema Isolation

- **Status**: Completed
- **Implementation**: Added `tenantId` to `CommerceCustomer` with `@@unique([tenantId, userId])` and `@@unique([tenantId, email])`. Customer profiles, carts, and order histories are completely isolated per storefront vertical.

### 3. GDPR & Historical Order Integrity

- **Status**: Completed
- **Implementation**: Changed `CommerceOrder.customer` relation to `onDelete: SetNull`. Account modifications/deletions no longer wipe historical revenue and tax records.

### 4. Role Model Consolidation & RBAC Migration

- **Status**: Completed
- **Implementation**: Removed `ADMIN` and `SELLER` from global `UserRole` enum. Merchant roles flow exclusively through `TenantMembership`. Migrated 100% of route middleware to granular `requirePermission(...)` permission checks.

### 5. Google Sign-In & Unified Social Identity Linking

- **Status**: Completed
- **Implementation**: Exposed `POST /api/v2/auth/google` with ID token verification (`google-auth-library`). Automatically links Google accounts to existing users by verified email address to prevent duplicate or conflicting identities.

---

## 🟢 Open Items (Next Steps)

### 1. Checkout Transactionality & Stock Deduction

- **Issue**: In `src/modules/commerce/order.service.ts` (`checkoutFromCart`), order creation and cart clearing execute sequentially without a single Prisma `$transaction`. Inventory stock levels are not decremented or verified during checkout.
- **Proposed Fix**: Wrap checkout logic in `prisma.$transaction` and integrate `InventoryRepository.decrementStock` to prevent overselling.

### 2. Order Item Financial Snapshots

- **Issue**: `CommerceOrderItem` has snapshot fields (`supplierCost`, `taxRate`), but checkout currently omits copying supplier costs and tax rate metadata from the catalog.
- **Proposed Fix**: Update `checkoutFromCart` to map all supplier cost and tax rate metadata into `CommerceOrderItem`.

### 3. Webhook & Order State Machine Validation

- **Issue**: Payment webhooks (`payment.service.ts`) and order status updates (`order.repository.ts`) accept status transitions without verifying current state, allowing out-of-order webhooks to regress status.
- **Proposed Fix**: Implement strict state machine transition validation in Payment and Order repositories.
