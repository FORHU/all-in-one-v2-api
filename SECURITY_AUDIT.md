# Security & Architecture Audit Report

This document outlines the remaining security and architectural vulnerabilities detected in the current codebase, mapped directly to the P1/P2 hardening priorities we discussed.

## 🔴 P1 — Critical & Strongly Recommended

### 1. Missing Webhook & Order State Machines

- **Issue**: In `src/modules/commerce/payment.service.ts`, the `handleWebhook` method blindly accepts payment status updates (e.g., transitions to `PAID` or `FAILED`) without checking the _current_ state of the payment. An out-of-order or delayed webhook could transition a `PAID` order back to `PENDING`.
- **Issue**: In `OrderRepository.updateStatus`, there is no validation to ensure order statuses move strictly forward (e.g., `PENDING -> PROCESSING -> FULFILLED`).
- **Proposed Fix**: Implement strict state machine validation in both Payment and Order repositories to reject invalid transitions.

### 2. Lack of Transactionality & Stock Deduction during Checkout

- **Issue**: In `src/modules/commerce/order.service.ts` (`checkoutFromCart`), order creation and cart clearing are executed sequentially, not within a database transaction. If cart clearing fails, the user is left with a duplicated cart.
- **Issue**: Inventory stock is completely ignored during checkout. Products can be bought even if they are out of stock.
- **Proposed Fix**: Wrap checkout logic in a Prisma `$transaction` and integrate `InventoryRepository.decrementStock` with optimistic locking to prevent overselling.

### 3. Incomplete Order Historical Snapshots

- **Issue**: While the `CommerceOrderItem` schema correctly includes snapshot fields (`supplierCost`, `taxRate`, `attributes`), the checkout logic in `order.service.ts` completely skips copying these values from the product catalog. If a supplier changes their cost or a tax rate changes tomorrow, historical analytics will be broken.
- **Proposed Fix**: Update `checkoutFromCart` to map all financial and supplier metadata fields into the order item snapshot.

### 4. Session Hardening & Revocation

- **Issue**: Users currently have no way to invalidate old sessions or log out of all devices. There is no session denylist or rotation mechanism in `auth.service.ts`.
- **Proposed Fix**: Implement a Redis-based JWT denylist to allow remote logout and session revocation if an account is compromised.

---

## 🟡 P2 — Production Hardening

### 5. Email Verification is Skipped

- **Issue**: `AuthRepo.createUser` hardcodes `isEmailVerified: true` for all new signups, bypassing the need for email verification.
- **Proposed Fix**: Set `isEmailVerified: false` by default and implement a secure token-based email verification flow.

### 6. Social Identity Conflicts

- **Issue**: The authentication system does not enforce strict identity linking. If a user signs in via Google, and later signs up via email/password using the same address, it could lead to duplicated or conflicting identities.
- **Proposed Fix**: Check for existing emails before allowing OAuth linking and enforce a unified identity model.
