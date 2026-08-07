# Module 1 — Authentication & User Management

**Platform:** All-In-One V2 — Multi-Tenant Headless Commerce Platform
**Module Scope:** `AuthUser`, `AuthSession`, `AuthSocialAccount`, `AuthFile`
**Audience:** Full-stack engineers, solution architects, QA, technical product managers
**Document Class:** SRS / TDD / Developer Documentation / Admin Manual / Database Documentation

---

## Module Architectural Position

Authentication & User Management is the **platform identity plane**. It sits _above_ the tenancy boundary and is deliberately **not tenant-scoped**.

This is the single most important architectural fact in this module, and it governs every design decision that follows:

> A person holds **one identity** across the entire platform. That identity can shop in the `fashion` storefront, the `beauty` storefront, and the `sports` storefront using the same credentials. Tenancy is applied to _commerce_ data (carts, orders, catalog), not to _identity_.

```mermaid
graph TD
    subgraph IP["IDENTITY PLANE — platform-wide, no tenantId"]
        AU["AuthUser"]
        AS["AuthSession"]
        ASA["AuthSocialAccount"]
        AF["AuthFile"]
    end

    subgraph TP["TENANCY PLANE — every row carries tenantId"]
        T["Tenant"]
        CP["CatalogProduct"]
        CO["CommerceOrder"]
        CART["CommerceCart"]
    end

    subgraph BP["BRIDGE — identity meets commerce"]
        CC["CommerceCustomer"]
    end

    AU -->|"1:1 optional"| CC
    CC -->|"1:N per tenant"| CO
    CC -->|"1:N per tenant"| CART
    T -.->|scopes| CP
    T -.->|scopes| CO
    AU -->|"1:N"| AS
    AU -->|"1:N"| ASA
    AF -->|"avatar"| AU

    style IP fill:#1e3a5f,color:#fff
    style TP fill:#3f2a56,color:#fff
    style BP fill:#1f4d3a,color:#fff
```

**Consequence for developers:** never add `tenantId` to `AuthUser`. If you need per-tenant user state (a loyalty tier in `beauty` that differs from `fashion`), it belongs on `CommerceCustomer` or a new tenant-scoped profile table — never on the identity record.

---

---

# AuthUser

## Overview

`AuthUser` is the **canonical identity record** for every human and service principal that can authenticate against the platform. It stores credentials, authorization role, lifecycle state, and the links out to sessions, social identities, audit history, and the commerce-side customer profile.

It represents _who someone is_, not _what they have bought_. The commercial identity — addresses, orders, carts, lifetime value — lives on `CommerceCustomer`, which hangs off this record one-to-one.

## Business Purpose

The model exists to answer four business questions that no other table can answer:

1. **Can this person prove who they are?** — via `email`/`username` + `password`, or via a federated social identity.
2. **What is this person allowed to do?** — via `role`.
3. **Is this person still a valid actor on the platform?** — via `isActive`, `isDeleted`, `isEmailVerified`.
4. **Who performed this action?** — via the `auditLogs` back-relation, which makes every privileged mutation attributable to a named individual.

Without a single unified identity record, a multi-vertical platform degrades into per-storefront user silos: the same shopper would hold three passwords, support could not correlate a complaint across verticals, and fraud signals could not be pooled.

## Responsibilities

| #   | Responsibility                                               | Enforced By                                |
| --- | ------------------------------------------------------------ | ------------------------------------------ |
| 1   | Uniquely identify a principal across the entire platform     | `email @unique`, `username @unique`        |
| 2   | Store the password verifier (never the password)             | `password String?` holding a bcrypt digest |
| 3   | Support credential-less accounts created purely via OAuth    | `password` is nullable                     |
| 4   | Carry the authorization role used by route guards            | `role UserRole @default(USER)`             |
| 5   | Permit administrative suspension without data loss           | `isActive Boolean @default(true)`          |
| 6   | Permit soft deletion preserving referential integrity        | `isDeleted Boolean @default(false)`        |
| 7   | Track email confirmation state                               | `isEmailVerified`                          |
| 8   | Track first-run onboarding completion                        | `onboardingCompleted`                      |
| 9   | Record last successful authentication for security analytics | `lastLoginAt`                              |
| 10  | Own the set of active refresh sessions                       | `sessions AuthSession[]`                   |
| 11  | Own the set of linked federated identities                   | `socialAccounts AuthSocialAccount[]`       |
| 12  | Anchor the audit trail                                       | `auditLogs AuditLog[]`                     |
| 13  | Anchor the notification inbox                                | `notifications Notification[]`             |
| 14  | Bridge into the commerce domain                              | `customer CommerceCustomer?`               |
| 15  | Reference a profile image managed by the file subsystem      | `avatar AuthFile?`                         |

## Features

- **Dual authentication modes** — local (email + password) and federated (social), on the same identity record.
- **Role-based access control** across five roles.
- **Account lifecycle states** — active, suspended, soft-deleted, unverified, un-onboarded.
- **Refresh-token session management** with rotation (one row per live session).
- **Multi-provider social linking**, constrained to one account per provider per user.
- **Avatar management** through the shared `AuthFile` subsystem.
- **Full audit attribution** for privileged operations.
- **In-app notification inbox** per user.
- **Transparent legacy password-hash migration** on successful login.

### Role Matrix

| Role          | Intended Principal                     | Current Authorization Surface                                               |
| ------------- | -------------------------------------- | --------------------------------------------------------------------------- |
| `USER`        | Retail shopper                         | Default. Owns carts, orders, wishlists, reviews.                            |
| `SELLER`      | Marketplace seller / merchant operator | Granted tenant management routes alongside admin roles (`tenant.route.ts`). |
| `ADMIN`       | Storefront operations staff            | Member of `ADMIN_ROLES`. Full catalog, order, CMS, analytics access.        |
| `SUPER_ADMIN` | Platform owner                         | Member of `ADMIN_ROLES`.                                                    |
| `DEVELOPER`   | Engineering / support tooling          | Member of `ADMIN_ROLES`.                                                    |

> **Implementation fact:** `ADMIN_ROLES` is defined in `src/middleware/auth.middleware.ts:82` as `[ADMIN, SUPER_ADMIN, DEVELOPER]`. `SELLER` is **not** a member and is granted access explicitly where needed. There is presently **no privilege separation between `ADMIN`, `SUPER_ADMIN`, and `DEVELOPER`** — they are interchangeable at every guard. See _Future Improvements_.

## Admin Features

Administrators operating through this model can:

- **List all platform users** — `GET /users` (guarded by `ADMIN_ROLES`).
- **Create users directly** — `POST /users`, bypassing self-registration, for staff onboarding.
- **Assign and change roles**, promoting a `USER` to `SELLER` or `ADMIN`.
- **Suspend an account** by setting `isActive = false`, which should block authentication while retaining all order history.
- **Soft-delete an account** by setting `isDeleted = true`, honouring erasure requests without orphaning orders, reviews, or audit records.
- **Inspect authentication posture** — `lastLoginAt`, `isEmailVerified`, linked social providers.
- **Attribute privileged actions** to a specific administrator through `AuditLog`.

## Customer Features

- **Self-registration** with email, username, password, and optional display name.
- **Login** and receive an access/refresh token pair.
- **Silent session renewal** via refresh-token rotation.
- **Logout**, destroying the server-side session.
- **View own profile** — `GET /users/me`.
- **View linked social accounts** — `GET /auth/social`.
- **Complete onboarding**, tracked by `onboardingCompleted`.
- **Receive notifications** through the `notifications` relation.

## Seller Features

The `SELLER` role is a first-class member of the `UserRole` enum and is explicitly authorized on tenant management routes, meaning a seller can participate in creating and administering a storefront vertical.

Sellers are, however, **still modelled as ordinary `AuthUser` records**. There is no `Seller` entity, no seller-to-tenant ownership join, and no seller-scoped product ownership. A seller today is "a user whose role string happens to be `SELLER`."

> **Architectural gap — flagged, not fixed:** true marketplace seller functionality (seller owns tenant X, may only edit products they created, receives payouts) requires a `SellerProfile` model and a `SellerTenant` join table. Documented in _Future Improvements_.

## Developer Notes

### Password handling

- Hashing and verification live in `src/utils/password.util.ts` (`hashPassword`, `verifyPassword`, `isLegacyHash`).
- `AuthSvc.login` performs **opportunistic rehashing**: login is the only moment the plaintext is in memory, so a password still stored under the legacy weak PBKDF2 scheme is transparently upgraded to the current bcrypt cost factor at that instant (`auth.service.ts:72-75`). This is the correct pattern and should be preserved.
- `password` is nullable. A user created through OAuth has `password = null`, and `login` rejects them with `Account uses social login` rather than a generic credential failure.

### The public user projection

`AuthSvc.generateAuthResponse` builds an explicit `publicUser` object before caching or returning (`auth.service.ts:148-156`). This is deliberate and load-bearing:

> The refresh path passes a **full Prisma `AuthUser`** into this helper, and that object carries the `password` hash. Caching or serialising the raw entity would write the password digest into Redis and into the HTTP response body.

**Never** return an `AuthUser` entity directly from a controller. Always project.

### Caching

The public projection is cached in Redis at key `user:{userId}` via `CacheUtil`. `logout` invalidates it. Any mutation to `role`, `isActive`, or `isDeleted` **must** invalidate this key, or a suspended user will continue to be served from cache until natural expiry.

### Known implementation gaps in this module

These are stated plainly because documentation that hides them is worse than no documentation:

| Gap                                           | Location                                               | Impact                                                                                                                                                                    |
| --------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `isEmailVerified` defaults to `true`          | `schema.prisma`                                        | Email verification is structurally defeated. `AuthSvc.register` comments confirm accounts are "verified by default in simple boilerplate". No verification email is sent. |
| No password reset flow                        | No route exists                                        | A user who forgets their password has no recovery path.                                                                                                                   |
| No OAuth callback route                       | `auth.route.ts` exposes only `GET /auth/social` (read) | `AuthSocialAccount` is modelled and readable but **never written to** by any code path.                                                                                   |
| No account lockout / rate limiting on `login` | `auth.service.ts`                                      | Credential stuffing is unthrottled at the service layer.                                                                                                                  |
| `isActive` is never checked at login          | `AuthSvc.login`                                        | Setting `isActive = false` currently does **not** prevent authentication. Only `isDeleted` is checked, and only on the refresh path.                                      |

The `isActive` gap is the most serious of these: an administrator suspending an account today achieves nothing.

## Fields Explanation

| Field                 | Type            | Purpose                                                    | Required | Notes                                                                                                                          |
| --------------------- | --------------- | ---------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `id`                  | `String` (UUID) | Primary key; stable external identifier                    | Yes      | UUID rather than sequential integer — prevents user enumeration and allows client-side ID generation.                          |
| `email`               | `String`        | Primary login credential and transactional contact address | Yes      | `@unique` platform-wide. Should be normalised to lowercase before persistence.                                                 |
| `password`            | `String?`       | Bcrypt digest of the password                              | No       | **Nullable by design** for social-only accounts. Never stores plaintext. Excluded from every API projection.                   |
| `name`                | `String?`       | Human display name                                         | No       | Free-form. Not used for authentication.                                                                                        |
| `username`            | `String`        | Secondary unique handle                                    | Yes      | `@unique` platform-wide. Public-facing identifier suitable for reviews and seller storefronts.                                 |
| `role`                | `UserRole`      | Authorization level                                        | Yes      | Defaults to `USER`. Drives every `authorize()` guard.                                                                          |
| `isActive`            | `Boolean`       | Administrative suspension flag                             | Yes      | Defaults `true`. **Currently not enforced at login — see Developer Notes.**                                                    |
| `lastLoginAt`         | `DateTime?`     | Timestamp of most recent successful authentication         | No       | Written by `updateUserLoginStatus`. Feeds dormancy reporting and anomaly detection.                                            |
| `createdAt`           | `DateTime`      | Account creation timestamp                                 | Yes      | Immutable. Basis for cohort analysis.                                                                                          |
| `updatedAt`           | `DateTime`      | Last mutation timestamp                                    | Yes      | Auto-maintained.                                                                                                               |
| `avatarId`            | `String?`       | FK to the profile image file                               | No       | Points at `AuthFile`. Nullable — most users never upload one.                                                                  |
| `isDeleted`           | `Boolean`       | Soft-deletion flag                                         | Yes      | Defaults `false`. Preserves referential integrity for orders, reviews, and audit logs belonging to erased users.               |
| `isEmailVerified`     | `Boolean`       | Email confirmation state                                   | Yes      | **Defaults `true`, which defeats its own purpose.** Should default `false` once a verification flow exists.                    |
| `onboardingCompleted` | `Boolean`       | First-run wizard completion                                | Yes      | Defaults `false`. Consumed by the client to decide whether to route into onboarding. Included in the cached public projection. |

### Enum: `UserRole`

| Value         | Semantic                                |
| ------------- | --------------------------------------- |
| `USER`        | Retail shopper. Platform default.       |
| `ADMIN`       | Storefront operations staff.            |
| `SUPER_ADMIN` | Platform owner.                         |
| `DEVELOPER`   | Engineering and support tooling.        |
| `SELLER`      | Marketplace seller / merchant operator. |

## Relationships

| Relation         | Cardinality            | Target              | Why It Exists                                                                                                                                                                            |
| ---------------- | ---------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `avatar`         | Many-to-One (optional) | `AuthFile`          | Profile images are managed by the same file subsystem as product media, so avatars gain CDN handling, MIME validation, and soft deletion for free rather than duplicating upload logic.  |
| `sessions`       | One-to-Many            | `AuthSession`       | A user legitimately holds several concurrent sessions — phone, laptop, tablet. One row per session enables per-device revocation instead of nuking all sessions on logout.               |
| `socialAccounts` | One-to-Many            | `AuthSocialAccount` | A single identity may federate to Google, Facebook, and TikTok simultaneously. Constrained by `@@unique([userId, platform])` so a user cannot link two Google accounts.                  |
| `customer`       | One-to-One (optional)  | `CommerceCustomer`  | **The identity-to-commerce bridge.** Optional because administrators and developers authenticate but never shop — creating a customer profile for them would pollute customer analytics. |
| `auditLogs`      | One-to-Many            | `AuditLog`          | Every privileged mutation is attributable to a named actor. Nullable on the audit side so system-initiated actions remain recordable.                                                    |
| `notifications`  | One-to-Many            | `Notification`      | The in-app inbox. Note that `Notification` **is** tenant-scoped, so the same user receives separate notification streams per storefront.                                                 |

### Why `customer` is one-to-one and optional

```mermaid
graph LR
    A["AuthUser<br/>(platform identity)"] -->|"0..1"| B["CommerceCustomer<br/>(commercial identity)"]
    B -->|"1..N"| C["Orders across<br/>all tenants"]
    B -->|"1..N"| D["Addresses"]
    B -->|"1..N"| E["Wishlists per tenant"]

    F["Admin user"] -.->|"no customer profile"| G["never appears in<br/>customer analytics"]

    style A fill:#1e3a5f,color:#fff
    style B fill:#1f4d3a,color:#fff
    style F fill:#5f1e1e,color:#fff
```

Separating the two allows the commerce domain to evolve — loyalty tiers, tax exemption status, credit terms — without touching the security-critical identity table.

## Business Workflow

### Registration through first purchase

```
Visitor submits registration form
        ↓
Uniqueness check on email AND username
        ↓  (conflict → 400 with the specific field named)
Password hashed with bcrypt
        ↓
AuthUser row created
  role=USER, isActive=true, isDeleted=false,
  isEmailVerified=true (see gap), onboardingCompleted=false
        ↓
Access token (short-lived JWT) + refresh token (JWT with jti) issued
        ↓
AuthSession row persisted, expiresAt = now + 7 days
        ↓
Public projection cached at Redis key user:{id}
        ↓
Client stores both tokens; routes user into onboarding
        ↓
Onboarding completed → onboardingCompleted = true
        ↓
User adds first item to cart in tenant "fashion"
        ↓
CommerceCustomer created on demand (1:1 with AuthUser)
        ↓
Checkout → CommerceOrder bound to (tenantId, customerId)
```

### Session renewal

```
Access token expires
        ↓
Client presents refresh token to POST /auth/refresh-token
        ↓
JWT signature + expiry verified against REFRESH_TOKEN_SECRET
        ↓
AuthSession looked up by exact token, expiresAt > now
        ↓
session.userId must equal the token's userId claim
        ↓
User re-fetched; rejected if isDeleted
        ↓
OLD SESSION DELETED  ← rotation: the presented token is single-use
        ↓
New token pair issued, new AuthSession row created
        ↓
Client MUST persist the new refresh token; the old one is dead
```

## User Journey

**Persona:** Maria, a first-time shopper arriving at `fashion.example.com`.

1. Maria browses anonymously. Her cart is keyed to a session ID, not an account.
2. At checkout she is prompted to register. She submits email, username, and password.
3. The platform rejects `maria` as a taken username and tells her so specifically — a deliberate UX trade-off against username enumeration.
4. She retries as `maria_dlc` and succeeds. She is logged in immediately; no email confirmation interrupts her checkout.
5. Her guest cart is associated with her new `CommerceCustomer` profile.
6. She completes onboarding — size preferences, style quiz — and `onboardingCompleted` flips to `true`.
7. She uploads an avatar; an `AuthFile` row is created and `avatarId` points at it.
8. Two weeks later she visits `beauty.example.com`. **The same credentials work.** Her identity is platform-wide; only her cart, orders, and wishlist are tenant-scoped.
9. Her phone's access token expires. The client silently rotates the refresh token. Maria notices nothing.
10. She logs out on a shared laptop. Only that session is destroyed; her phone stays signed in.

## Admin Workflow

**Persona:** Danilo, platform operations administrator.

1. Danilo authenticates and receives a token whose `role` is `ADMIN`.
2. He opens the user directory — `GET /users`, guarded by `ADMIN_ROLES`.
3. He investigates a fraud report, inspecting `lastLoginAt`, `isEmailVerified`, and linked social providers.
4. He suspends the account by setting `isActive = false`. _(Note: until the login guard is implemented, this is advisory only.)_
5. He invalidates the Redis cache key `user:{id}` and deletes the user's `AuthSession` rows to force re-authentication.
6. Every one of these actions writes an `AuditLog` row carrying his `userId`, the entity, and before/after state.
7. On a later erasure request he sets `isDeleted = true` rather than issuing a hard delete, preserving the order and review history that other tenants' financial reporting depends on.

```mermaid
sequenceDiagram
    participant Admin
    participant API as Admin API
    participant Guard as authorize(ADMIN_ROLES)
    participant Svc as UserService
    participant DB as PostgreSQL
    participant Cache as Redis
    participant Audit as AuditLog

    Admin->>API: PATCH /users/{id} { isActive: false }
    API->>Guard: verify JWT + role
    Guard-->>API: role=ADMIN, permitted
    API->>Svc: suspendUser(id, actor)
    Svc->>DB: UPDATE auth_users SET isActive=false
    DB-->>Svc: updated row
    Svc->>DB: DELETE FROM auth_sessions WHERE userId=id
    Svc->>Cache: DEL user:{id}
    Svc->>Audit: write { action, entity, before, after, actorId }
    Svc-->>API: suspended
    API-->>Admin: 200 OK
```

## API Responsibilities

### Implemented today

| Method | Endpoint              | Auth                   | Purpose                                            |
| ------ | --------------------- | ---------------------- | -------------------------------------------------- |
| `POST` | `/auth/register`      | Public                 | Create an account and return the first token pair. |
| `POST` | `/auth/login`         | Public                 | Exchange credentials for a token pair.             |
| `POST` | `/auth/refresh-token` | Public (token in body) | Rotate the refresh token; issue a new pair.        |
| `POST` | `/auth/logout`        | Authenticated          | Destroy the presented session and clear cache.     |
| `GET`  | `/auth/social`        | Authenticated          | List the caller's linked social accounts.          |
| `GET`  | `/auth/files`         | Authenticated          | List files. **See security warning below.**        |
| `GET`  | `/users/me`           | Authenticated          | Return the caller's public profile.                |
| `GET`  | `/users`              | `ADMIN_ROLES`          | Paginated user directory.                          |
| `POST` | `/users`              | `ADMIN_ROLES`          | Administratively provision a user.                 |

### Recommended additions

| Method   | Endpoint                            | Auth           | Purpose                                                                                              |
| -------- | ----------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------- |
| `PATCH`  | `/users/me`                         | Authenticated  | Update own `name`, `avatarId`, `onboardingCompleted`.                                                |
| `PATCH`  | `/users/me/password`                | Authenticated  | Change password; requires current password; must revoke all other sessions.                          |
| `POST`   | `/auth/verify-email`                | Public (token) | Consume a verification token; set `isEmailVerified = true`.                                          |
| `POST`   | `/auth/resend-verification`         | Authenticated  | Re-issue the verification email; rate-limited.                                                       |
| `POST`   | `/auth/forgot-password`             | Public         | Issue a single-use, short-TTL reset token. Must respond identically for known and unknown addresses. |
| `POST`   | `/auth/reset-password`              | Public (token) | Consume the reset token; revoke every session.                                                       |
| `GET`    | `/auth/sessions`                    | Authenticated  | List own active sessions with device metadata.                                                       |
| `DELETE` | `/auth/sessions/{id}`               | Authenticated  | Revoke one session (remote sign-out).                                                                |
| `DELETE` | `/auth/sessions`                    | Authenticated  | Revoke all sessions except the current one.                                                          |
| `GET`    | `/auth/social/{platform}/authorize` | Public         | Begin the OAuth authorization-code flow.                                                             |
| `GET`    | `/auth/social/{platform}/callback`  | Public         | Complete OAuth; create or link `AuthSocialAccount`.                                                  |
| `DELETE` | `/auth/social/{platform}`           | Authenticated  | Unlink a provider. Must refuse if it is the only credential.                                         |
| `GET`    | `/users/{id}`                       | `ADMIN_ROLES`  | Fetch one user.                                                                                      |
| `PATCH`  | `/users/{id}`                       | `ADMIN_ROLES`  | Change `role`, `isActive`.                                                                           |
| `DELETE` | `/users/{id}`                       | `SUPER_ADMIN`  | Soft-delete (`isDeleted = true`).                                                                    |

### Endpoint semantics worth stating explicitly

- **`POST /auth/refresh-token` is destructive.** It deletes the presented session before issuing a new one. A client that retries this call with the old token on network failure will be rejected. Clients must serialise refresh calls behind a mutex.
- **`POST /auth/logout` is idempotent.** It uses `deleteMany`, so replaying it is harmless.
- **`DELETE /users/{id}` must never hard-delete.** `AuditLog.userId`, `ProductReview.customerId`, and order history all reference this record.

## Validation Rules

### Registration

| Rule                                                                   | Enforcement Point                              | Status                                                      |
| ---------------------------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------- |
| `email` must be globally unique                                        | DB `@unique` + pre-check in `AuthSvc.register` | Implemented                                                 |
| `username` must be globally unique                                     | DB `@unique` + pre-check                       | Implemented                                                 |
| Conflict must name the offending field                                 | `AuthSvc.register`                             | Implemented                                                 |
| `email` must be RFC-valid                                              | Joi schema at the route boundary               | **Verify — should be enforced**                             |
| `email` should be lowercased before persistence                        | Service layer                                  | **Recommended — prevents `A@x.com` / `a@x.com` duplicates** |
| `password` minimum 8 characters, mixed classes                         | Joi schema                                     | **Recommended**                                             |
| `password` must be bcrypt-hashed before persistence                    | `hashPassword`                                 | Implemented                                                 |
| `username` 3–30 chars, `[a-zA-Z0-9_.-]` only                           | Joi schema                                     | **Recommended**                                             |
| `username` must not collide with reserved words (`admin`, `api`, `me`) | Service layer                                  | **Recommended**                                             |

### Authentication

| Rule                                                                                        | Status                                         |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Unknown email and wrong password must return the **same** generic `401 Invalid credentials` | Implemented                                    |
| Social-only accounts must be rejected with a distinct message                               | Implemented                                    |
| `isDeleted` users must be rejected                                                          | Implemented on refresh path only               |
| `isActive = false` users must be rejected                                                   | **NOT IMPLEMENTED — suspension has no effect** |
| Failed attempts must be rate-limited per IP and per account                                 | **NOT IMPLEMENTED**                            |

### Refresh

| Rule                                                       | Status                                         |
| ---------------------------------------------------------- | ---------------------------------------------- |
| Token signature must verify against `REFRESH_TOKEN_SECRET` | Implemented                                    |
| A matching, unexpired `AuthSession` must exist             | Implemented                                    |
| `session.userId` must equal the token's `userId` claim     | Implemented — prevents cross-user token replay |
| Presented token must be single-use                         | Implemented via delete-then-issue              |

## Security Considerations

### Authentication

Stateless JWT access tokens paired with **stateful, database-backed refresh tokens**. The stateful half is what makes revocation possible: deleting the `AuthSession` row immediately ends the ability to renew, capping an attacker's window at the access-token TTL.

Refresh tokens carry a random `jti` (`crypto.randomBytes(16)`), so two tokens minted for the same user in the same second are still distinct.

### Authorization

Enforced by `authenticate` (identity) and `authorize(...roles)` (privilege) middleware. `ADMIN_ROLES` is the standard administrative bundle.

**Weakness:** `ADMIN`, `SUPER_ADMIN`, and `DEVELOPER` are functionally identical. A compromised `DEVELOPER` account has the same blast radius as the platform owner. Genuine privilege tiering is required before production.

### Access control

**⚠ Active finding — `GET /auth/files`:**

`AuthRepo.getFiles()` executes `prisma.authFile.findMany({ take: 10 })` with **no `where` clause of any kind**. Any authenticated user — including a freshly registered `USER` — receives ten arbitrary file records from the platform-wide pool, spanning every tenant. This is a horizontal privilege escalation and cross-tenant data exposure. It must be scoped to the caller (or to `ADMIN_ROLES`) before production.

### Encryption

| Data                            | At Rest           | Assessment                                                                                                                                                |
| ------------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `password`                      | Bcrypt digest     | Correct. Legacy PBKDF2 hashes are upgraded on login.                                                                                                      |
| `AuthSession.refreshToken`      | **Plaintext JWT** | **Weak.** A read-only database compromise yields directly replayable refresh tokens for every live session. Store a SHA-256 digest and look up by digest. |
| `AuthSocialAccount.accessToken` | **Plaintext**     | **Weak.** These are live third-party API credentials. Requires envelope encryption via KMS.                                                               |

### Soft delete

`isDeleted` preserves referential integrity across `AuditLog`, `ProductReview`, and order history. Every user-facing query must filter `isDeleted = false`; the refresh path already does. A hard delete would either orphan financial records or cascade into destroying them.

> **Consistency note:** this module uses `isDeleted Boolean`, while `CatalogProduct`, `CatalogCategory`, and `Coupon` use `deletedAt DateTime?`. Two soft-delete conventions coexist in one schema. `deletedAt` is strictly more informative and should become the standard.

### Audit logging

`AuditLog` captures `action`, `entity`, `entityId`, `beforeState`, `afterState`, `requestId`, `correlationId`, and `ipAddress`. `userId` is nullable so system actions remain recordable. Every role change, suspension, and soft delete must write one.

### Additional hardening required

- Rate limiting on `/auth/login`, `/auth/register`, `/auth/forgot-password` (`express-rate-limit` is already a dependency).
- Progressive account lockout after repeated failures.
- Refresh-token **reuse detection**: if a deleted token is presented again, treat it as theft and revoke the entire session family.
- Deliver refresh tokens as `httpOnly`, `Secure`, `SameSite=Strict` cookies for browser clients.
- Multi-factor authentication for all `ADMIN_ROLES` members.

## Performance Considerations

### Indexes

| Index                     | Origin      | Serves                        |
| ------------------------- | ----------- | ----------------------------- |
| `auth_users_pkey` on `id` | Primary key | Point lookups, all FK joins   |
| `auth_users_email_key`    | `@unique`   | Login path                    |
| `auth_users_username_key` | `@unique`   | Registration uniqueness check |

**Missing and recommended:**

| Proposed Index                   | Justification                                                                                 |
| -------------------------------- | --------------------------------------------------------------------------------------------- |
| `@@index([role])`                | The admin directory filters by role; currently a sequential scan.                             |
| `@@index([isDeleted, isActive])` | Every list endpoint filters both; a partial index `WHERE isDeleted = false` is cheaper still. |
| `@@index([createdAt])`           | Cohort and registration-trend reporting.                                                      |
| `@@index([lastLoginAt])`         | Dormant-account sweeps.                                                                       |

### Query optimization

`findUserByEmailOrUsername` uses an `OR` across two separately indexed unique columns. PostgreSQL can resolve this via a bitmap index scan, but two explicit lookups are more predictable and let the service report _which_ field conflicted without re-querying.

### Pagination

`GET /users` must be keyset-paginated (`WHERE createdAt < $cursor ORDER BY createdAt DESC LIMIT n`) rather than offset-paginated. Offset pagination degrades linearly and produces duplicate rows when the underlying set mutates mid-scan.

### Caching

The public projection is cached at `user:{userId}`. This is the hot path — `authenticate` resolves it on every authenticated request.

**Invalidation contract:** any write to `role`, `isActive`, `isDeleted`, `name`, or `avatarId` **must** `DEL user:{id}`. Failing to do so means a suspended or demoted user retains their privileges until natural expiry. Currently only `logout` invalidates.

### Lazy vs. eager loading

- **Eager-load** `avatar` on `/users/me` — the client needs the URL immediately, and it is a single indexed join.
- **Lazy-load** `sessions`, `auditLogs`, and `notifications` — these are unbounded collections. Eager-loading `auditLogs` on a long-lived administrator would materialise tens of thousands of rows.
- **Never** eager-load `customer → orders` from a user endpoint. Cross the boundary explicitly through the order API.

## Future Improvements

| #   | Improvement                                                       | Priority     | Rationale                                                      |
| --- | ----------------------------------------------------------------- | ------------ | -------------------------------------------------------------- |
| 1   | Enforce `isActive` at login                                       | **Critical** | Suspension is currently a no-op.                               |
| 2   | Scope or restrict `GET /auth/files`                               | **Critical** | Cross-tenant data exposure to any authenticated user.          |
| 3   | Store a hash of `refreshToken`, not the token                     | **Critical** | Database read compromise currently yields replayable sessions. |
| 4   | Default `isEmailVerified` to `false` and ship a verification flow | **High**     | The field is inert as configured.                              |
| 5   | Password reset flow                                               | **High**     | No recovery path exists.                                       |
| 6   | Rate limiting and progressive lockout on auth endpoints           | **High**     | Credential stuffing is unthrottled.                            |
| 7   | Encrypt `AuthSocialAccount.accessToken` at rest                   | **High**     | Live third-party credentials in plaintext.                     |
| 8   | Genuine privilege separation across admin roles                   | **High**     | Three roles, one privilege level.                              |
| 9   | Implement the OAuth callback flow                                 | **Medium**   | `AuthSocialAccount` is currently write-never.                  |
| 10  | MFA/TOTP for administrative roles                                 | **Medium**   | Standard for privileged access.                                |
| 11  | Session device metadata (user agent, IP, geo)                     | **Medium**   | Required for a usable "your active sessions" screen.           |
| 12  | Refresh-token reuse detection                                     | **Medium**   | Converts token theft from silent to detectable.                |
| 13  | Migrate `isDeleted` → `deletedAt`                                 | **Low**      | Schema-wide consistency; retains _when_.                       |
| 14  | `SellerProfile` + `SellerTenant` models                           | **Low**      | Prerequisite for true marketplace semantics.                   |
| 15  | Fine-grained permissions replacing coarse roles                   | **Low**      | Enterprises need "can refund up to ₱5,000" granularity.        |

## Example Data

### Registration request

```json
{
  "email": "maria.delacruz@example.com",
  "username": "maria_dlc",
  "password": "C0rrect-Horse-Battery!",
  "name": "Maria Dela Cruz"
}
```

### Successful authentication response

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJiN2E...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJiN2E...",
  "user": {
    "id": "b7a3f1c2-9d4e-4a8b-b1f0-6c2e5d9a3f74",
    "email": "maria.delacruz@example.com",
    "username": "maria_dlc",
    "name": "Maria Dela Cruz",
    "role": "USER",
    "avatar": "https://cdn.example.com/files/avatars/b7a3f1c2.jpg",
    "onboardingCompleted": false
  }
}
```

> Note the response carries **no** `password`, `isDeleted`, or `isActive`. This is the `publicUser` projection.

### Administrative user creation

```json
{
  "email": "danilo.ops@example.com",
  "username": "danilo_ops",
  "password": "provisioned-then-rotated",
  "name": "Danilo Ramos",
  "role": "ADMIN"
}
```

### Error responses

```json
{ "status": 400, "message": "User with this email already exists" }
```

```json
{ "status": 400, "message": "Username is already taken" }
```

```json
{ "status": 401, "message": "Invalid credentials" }
```

```json
{ "status": 401, "message": "Account uses social login" }
```

## Example Database Record

`auth_users`

```json
{
  "id": "b7a3f1c2-9d4e-4a8b-b1f0-6c2e5d9a3f74",
  "email": "maria.delacruz@example.com",
  "password": "$2b$12$eImiTXuWVxfM37uY4JANjQ==.LxGqLZ8xW1nOZ3pKvBqYy8dQ2rGm",
  "name": "Maria Dela Cruz",
  "username": "maria_dlc",
  "role": "USER",
  "isActive": true,
  "lastLoginAt": "2026-08-07T02:14:33.117Z",
  "createdAt": "2026-07-22T09:41:02.884Z",
  "updatedAt": "2026-08-07T02:14:33.121Z",
  "avatarId": "3f9c1e77-2b64-4d51-9a0e-8c7f2d1b6e45",
  "isDeleted": false,
  "isEmailVerified": true,
  "onboardingCompleted": true
}
```

`auth_users` — administrator

```json
{
  "id": "e2c88a41-7f13-4c2d-9b55-0af3d6e91c28",
  "email": "danilo.ops@example.com",
  "password": "$2b$12$9pLmQvR3sT7uV1wX2yZ4aO==.KjHgFdSa5bN8mC0xQwErTyUiOp",
  "name": "Danilo Ramos",
  "username": "danilo_ops",
  "role": "ADMIN",
  "isActive": true,
  "lastLoginAt": "2026-08-07T08:02:19.445Z",
  "createdAt": "2026-05-03T11:20:44.019Z",
  "updatedAt": "2026-08-07T08:02:19.448Z",
  "avatarId": null,
  "isDeleted": false,
  "isEmailVerified": true,
  "onboardingCompleted": true
}
```

## Real World Example

| Platform            | Comparable Design                                                                                                                | Relevance                                                                                                                                    |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Shopify**         | Separates _Shopify ID_ (platform identity, works across every store) from _Customer_ (per-shop commercial record).               | This is precisely the `AuthUser` → `CommerceCustomer` split. Shopify validated it at scale: one login, many storefronts.                     |
| **Amazon**          | One account spans retail, Prime Video, AWS, Kindle. Roles and entitlements are layered on top of a single identity.              | Mirrors the non-tenant-scoped identity plane. Amazon adds entitlements per service — the direction recommended in _Future Improvements #15_. |
| **Lazada / Shopee** | Buyer and Seller Centre share a login but diverge into distinct profile entities with separate onboarding, KYC, and payout data. | Exactly the gap flagged under _Seller Features_: a role string is insufficient; a `SellerProfile` is required.                               |
| **Stripe**          | Team members hold one identity with per-account roles; API keys are separate credentials with independent lifecycles.            | Argues for splitting human sessions from machine credentials rather than overloading `AuthUser.role`.                                        |
| **Google**          | Federated identity where OAuth linkage is a first-class object, and "Your devices" exposes per-session revocation.               | The target state for `AuthSocialAccount` and `AuthSession` respectively.                                                                     |

## Sequence Diagram

### Registration

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant API as POST /auth/register
    participant Svc as AuthSvc
    participant Repo as AuthRepo
    participant DB as PostgreSQL
    participant Cache as Redis

    C->>API: { email, username, password, name }
    API->>Svc: register(data)
    Svc->>Repo: findUserByEmailOrUsername
    Repo->>DB: SELECT ... WHERE email=? OR username=?
    DB-->>Repo: null
    Repo-->>Svc: no conflict
    Svc->>Svc: hashPassword(password)
    Svc->>Repo: createUser({ ..., password: hash })
    Repo->>DB: INSERT INTO auth_users
    DB-->>Repo: AuthUser
    Svc->>Svc: sign access + refresh JWTs (refresh carries jti)
    Svc->>Repo: createSession({ userId, refreshToken, expiresAt })
    Repo->>DB: INSERT INTO auth_sessions
    Svc->>Svc: build publicUser projection (drops password)
    Svc->>Cache: SET user:{id}
    Svc-->>API: { accessToken, refreshToken, user }
    API-->>C: 201 Created
```

### Login with legacy hash upgrade

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant Svc as AuthSvc
    participant Repo as AuthRepo
    participant DB as PostgreSQL

    C->>Svc: login(email, password)
    Svc->>Repo: findUserByEmail
    Repo->>DB: SELECT * FROM auth_users WHERE email=?
    DB-->>Svc: AuthUser (password = legacy PBKDF2 digest)

    alt no user OR password mismatch
        Svc-->>C: 401 Invalid credentials
    else password is null
        Svc-->>C: 401 Account uses social login
    else valid
        Svc->>Svc: verifyPassword → true
        Svc->>Svc: isLegacyHash(stored) → true
        Note over Svc: Login is the only moment the<br/>plaintext exists in memory — the<br/>only chance to rehash.
        Svc->>Repo: updateUser(id, { password: bcrypt(plaintext) })
        Repo->>DB: UPDATE auth_users SET password=?
        Svc->>Repo: updateUserLoginStatus(id)
        Repo->>DB: UPDATE auth_users SET lastLoginAt=now()
        Svc-->>C: { accessToken, refreshToken, user }
    end
```

### Refresh-token rotation

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant Svc as AuthSvc
    participant DB as PostgreSQL

    C->>Svc: POST /auth/refresh-token { refreshToken }
    Svc->>Svc: jwt.verify(token, REFRESH_TOKEN_SECRET)

    alt signature invalid or expired
        Svc-->>C: 401 Invalid refresh token
    else signature valid
        Svc->>DB: SELECT * FROM auth_sessions WHERE refreshToken=? AND expiresAt > now()
        DB-->>Svc: AuthSession | null

        alt no live session
            Svc-->>C: 401 Invalid refresh token
        else session.userId != token.userId
            Note over Svc: Cross-user replay attempt
            Svc-->>C: 401 Invalid refresh token
        else user.isDeleted
            Svc-->>C: 401 Invalid refresh token
        else all checks pass
            Svc->>DB: DELETE FROM auth_sessions WHERE refreshToken=?
            Note over Svc,DB: Rotation — the presented<br/>token is now permanently dead
            Svc->>DB: INSERT new auth_sessions row
            Svc-->>C: { new accessToken, new refreshToken, user }
        end
    end
```

## Entity Relationship Explanation

```mermaid
erDiagram
    AuthUser ||--o{ AuthSession : "holds concurrent sessions"
    AuthUser ||--o{ AuthSocialAccount : "federates to providers"
    AuthUser ||--o| CommerceCustomer : "may shop as"
    AuthUser ||--o{ AuditLog : "is accountable for"
    AuthUser ||--o{ Notification : "receives"
    AuthFile ||--o{ AuthUser : "supplies avatar to"
    CommerceCustomer ||--o{ CommerceOrder : "places"
    CommerceCustomer ||--o{ CommerceShippingAddress : "owns"
    CommerceCustomer ||--o{ Wishlist : "curates"
    CommerceCustomer ||--o{ ProductReview : "authors"
```

`AuthUser` is the **root of the identity aggregate**. Every arrow out of it is a "has" relationship; nothing outside the module owns a user.

The critical boundary is `AuthUser → CommerceCustomer`. Everything left of that edge is platform-wide and tenant-agnostic. Everything right of it is tenant-scoped commerce. That single optional one-to-one is where identity becomes commerce, and it is the correct place to enforce the transition — an administrator crossing it accidentally would corrupt customer analytics with staff accounts.

`AuthFile → AuthUser` runs in the opposite direction to intuition: the file does not belong to the user; the user _references_ a file. This is what allows one file record to serve as an avatar, a product image, and a CMS banner simultaneously without duplication.

## Best Practices

1. **Never return the entity; always project.** The refresh path proves the risk — it hands a full Prisma entity, password hash included, into the response builder.
2. **Treat the Redis projection as a cache, not a source of truth.** Invalidate on every privilege-affecting write.
3. **Keep authentication failures indistinguishable.** Unknown email and wrong password must produce the same `401`.
4. **Rotate refresh tokens on every use** — already implemented; do not regress it for client convenience.
5. **Bind the session to the token's subject.** The `session.userId !== decoded.userId` check blocks a whole class of replay attack.
6. **Soft-delete users, always.** Orders, reviews, and audit rows depend on this record existing.
7. **Rehash opportunistically at login.** The only moment the plaintext is available.
8. **Normalise email to lowercase** before persisting and before lookup.
9. **Keep `AuthUser` free of tenant columns.** Per-tenant state belongs on `CommerceCustomer`.
10. **Write an `AuditLog` row for every privileged mutation**, capturing before and after state.

## Common Mistakes

| Mistake                                                  | Consequence                                                    | Correct Approach                                            |
| -------------------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------- |
| Returning the raw `AuthUser` from a controller           | Password hash leaks into the API response and Redis            | Build the `publicUser` projection                           |
| Adding `tenantId` to `AuthUser`                          | Fractures identity; the same person needs N accounts           | Put tenant state on `CommerceCustomer`                      |
| Hard-deleting a user                                     | Orphans or destroys orders, reviews, and audit history         | Set `isDeleted = true`                                      |
| Forgetting to invalidate `user:{id}` after a role change | Demoted or suspended user retains privileges until TTL expiry  | `CacheUtil.del` on every privilege write                    |
| Distinguishing "no such email" from "wrong password"     | Account enumeration                                            | One generic `401`                                           |
| Storing the refresh token in `localStorage`              | XSS yields a long-lived credential                             | `httpOnly` + `Secure` + `SameSite=Strict` cookie            |
| Retrying `POST /auth/refresh-token` with the same token  | The token was consumed by the first call; the retry hard-fails | Serialise refresh behind a client-side mutex                |
| Assuming `isActive = false` blocks login                 | It does not — the guard is unimplemented                       | Add the check to `AuthSvc.login`                            |
| Assuming `isEmailVerified` means the email was verified  | It defaults to `true` and nothing sets it                      | Ship the verification flow first                            |
| Eager-loading `auditLogs` or `notifications`             | Unbounded result sets on long-lived accounts                   | Paginate through their own endpoints                        |
| Trusting `role` from the JWT without re-checking         | A token minted before demotion still claims the old role       | Resolve role from cache/DB, and keep access-token TTL short |

---

---

# AuthSession

## Overview

`AuthSession` is a **server-side record of one live authenticated session**. Each row represents a single refresh token that has been issued and not yet consumed, revoked, or expired.

Its existence is what converts an otherwise stateless JWT scheme into a **revocable** one.

## Business Purpose

JWTs cannot be un-issued. A signed access token remains cryptographically valid until it expires, no matter what happens to the account. For a commerce platform holding payment instruments and addresses, "we cannot log this person out" is not an acceptable security posture.

`AuthSession` solves this by making the _long-lived_ half of the token pair stateful. The short-lived access token stays stateless and fast; the refresh token is checked against the database on every renewal. Deleting the row caps the attacker's remaining access at the access-token TTL.

It also supports a plain product requirement: **a user has more than one device.** One row per session means signing out on a shared laptop does not sign the user out on their phone.

## Responsibilities

| #   | Responsibility                                                        |
| --- | --------------------------------------------------------------------- |
| 1   | Persist the issued refresh token so it can be validated on renewal    |
| 2   | Enforce an absolute session lifetime via `expiresAt`                  |
| 3   | Bind the session to exactly one `AuthUser`                            |
| 4   | Record which authentication provider established the session          |
| 5   | Carry the provider-supplied avatar URL captured at sign-in            |
| 6   | Enable per-session revocation (logout on one device)                  |
| 7   | Enable bulk revocation (suspension, password change)                  |
| 8   | Guarantee refresh-token single-use through delete-then-issue rotation |

## Features

- **One row per live session**, enabling per-device control.
- **Absolute expiry** — 7 days from issuance, set explicitly by `AuthSvc`.
- **Global token uniqueness** via `refreshToken @unique`.
- **Rotation on every use** — the presented token is deleted before a replacement is minted.
- **Provider attribution** distinguishing local from federated sessions.
- **Indexed user lookup** for "list my sessions" and bulk revocation.

## Admin Features

- **Force sign-out** of a specific user by deleting their session rows — the operative half of account suspension.
- **Inspect concurrent session count**, a practical signal for credential sharing or account takeover.
- **Determine authentication method** per session through `provider`.
- **Purge expired sessions** on a schedule to bound table growth.

## Customer Features

- **Stay signed in** across app restarts without re-entering credentials.
- **Silent renewal** — the client rotates in the background and the user never notices.
- **Sign out on one device** while remaining signed in elsewhere.
- _(Recommended)_ **View and revoke active sessions** — requires the device-metadata fields listed in _Future Improvements_.

## Seller Features

No seller-specific behaviour. Sellers hold sessions on identical terms to every other principal.

> For enterprise seller accounts, shorter session lifetimes and mandatory MFA re-authentication on privileged actions are recommended — neither is implemented.

## Developer Notes

### Rotation is destructive and non-idempotent

`AuthSvc.refreshToken` deletes the session **before** issuing the replacement (`auth.service.ts:108`). Two consequences developers must design around:

1. **A client that retries after a network timeout will fail.** The first call may have succeeded server-side; the token is already gone. Clients must serialise refresh calls behind a mutex and share the single in-flight promise across concurrent 401 retries.
2. **There is no reuse detection.** Presenting an already-consumed token yields a generic `401`, indistinguishable from an expired one. A stolen-and-replayed token therefore looks like ordinary expiry. Industry practice is to treat reuse as proof of theft and revoke the entire session family — see _Future Improvements_.

### The token is stored verbatim

`refreshToken` holds the complete, signed JWT in plaintext. Anyone with `SELECT` on `auth_sessions` — a backup, a read replica, a log of a slow query — holds directly replayable credentials for every live session.

**Recommended remediation:** store `SHA-256(token)` and look up by digest. The lookup stays a single indexed equality match, and a database compromise yields only useless digests.

### Expiry is set in two independent places

The JWT's own `exp` comes from `REFRESH_TOKEN_EXPIRY` in config, while `AuthSession.expiresAt` is hardcoded to `now + 7 days` (`auth.service.ts:141`). **These can drift.** If `REFRESH_TOKEN_EXPIRY` is changed to 30 days, the JWT stays valid for 30 days but the session row still expires at 7 — sessions die early with no obvious cause. Derive both from the same constant.

### Validation is a conjunction

`findValidSession` matches on exact token **and** `expiresAt > now()`. An expired row is simply not found, so expired sessions fail closed even before any cleanup job runs. Cleanup is therefore a storage concern, not a security one.

### No cleanup job exists

Nothing deletes expired rows. `auth_sessions` grows monotonically. With `node-cron` already a dependency, a nightly `DELETE FROM auth_sessions WHERE "expiresAt" < now()` is trivial and should be added.

## Fields Explanation

| Field               | Type            | Purpose                               | Required | Notes                                                                                                 |
| ------------------- | --------------- | ------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------- |
| `id`                | `String` (UUID) | Primary key                           | Yes      | Would become the handle for per-session revocation endpoints.                                         |
| `userId`            | `String`        | Owning user                           | Yes      | FK to `AuthUser.id`. Indexed.                                                                         |
| `createdAt`         | `DateTime`      | Session establishment time            | Yes      | Feeds "signed in since" displays and anomaly detection.                                               |
| `expiresAt`         | `DateTime`      | Absolute expiry                       | Yes      | Set to `now + 7 days`. Part of the `findValidSession` predicate.                                      |
| `refreshToken`      | `String`        | The issued refresh JWT                | Yes      | `@unique`. **Stored in plaintext — see Developer Notes.** Contains a random `jti`.                    |
| `provider`          | `String?`       | Authentication method                 | No       | `"local"` for credentials; the platform name for federated sign-in. Carried into the rotated session. |
| `providerAvatarUrl` | `String?`       | Avatar URL from the identity provider | No       | Snapshot at sign-in. Lets a social user display a picture without an `AuthFile` upload.               |

## Relationships

| Relation | Cardinality | Target     | Why It Exists                                                                                                                    |
| -------- | ----------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `user`   | Many-to-One | `AuthUser` | Every session belongs to exactly one identity. The inverse `AuthUser.sessions` powers "sign out everywhere" and session listing. |

**Cascade behaviour:** the relation declares no `onDelete`, so PostgreSQL defaults to `RESTRICT`. A user with live sessions cannot be hard-deleted. Given the platform's soft-delete policy this is consistent, but it means any hard-delete tooling must clear sessions first.

## Business Workflow

```
Credentials or OAuth callback validated
        ↓
Access token signed  (short TTL, stateless)
Refresh token signed (long TTL, random jti)
        ↓
AuthSession row INSERTed
  { userId, refreshToken, expiresAt = now + 7d, provider }
        ↓
Both tokens returned to the client
        ↓
    ─── normal operation ───
Client calls APIs with the access token
        ↓
Access token expires → API returns 401
        ↓
Client presents refresh token
        ↓
Signature verified → session looked up → userId cross-checked → user not deleted
        ↓
OLD SESSION ROW DELETED          ← single-use enforcement
        ↓
New pair issued, new row INSERTed, provider carried forward
        ↓
    ─── termination ───
Logout        → row deleted by token
Suspension    → all rows for userId deleted
Natural expiry→ row no longer matches findValidSession
```

## User Journey

**Persona:** Maria, signed in on a phone and a shared library computer.

1. She signs in on her phone. Session A is created, expiring in 7 days.
2. She signs in at the library. Session B is created. **Two independent rows now exist.**
3. Browsing on her phone, the access token expires. The app silently rotates: session A is deleted, session A′ is created. Maria notices nothing.
4. She leaves the library and clicks "Log out". Only session B is deleted. **Her phone remains signed in** — the outcome she expects.
5. She forgets to log out on a second occasion. Session B expires on its own after 7 days and stops satisfying `findValidSession`, failing closed.
6. Later she reports suspicious activity. Support deletes every session row for her `userId`, forcing re-authentication everywhere.

## Admin Workflow

```mermaid
sequenceDiagram
    autonumber
    participant Admin
    participant API as Admin API
    participant DB as PostgreSQL
    participant Cache as Redis
    participant Attacker

    Note over Attacker: Holds a stolen access token<br/>and a stolen refresh token
    Admin->>API: Suspend user {id}
    API->>DB: UPDATE auth_users SET isActive=false
    API->>DB: DELETE FROM auth_sessions WHERE "userId"={id}
    API->>Cache: DEL user:{id}
    API-->>Admin: 200 OK

    Attacker->>API: request with stolen ACCESS token
    Note over API: Still cryptographically valid.<br/>Works until its short TTL elapses —<br/>this is the residual window.
    API-->>Attacker: 200 OK

    Note over Attacker: Access token expires
    Attacker->>API: POST /auth/refresh-token
    API->>DB: SELECT ... WHERE refreshToken=? AND expiresAt > now()
    DB-->>API: no rows — session was deleted
    API-->>Attacker: 401 Invalid refresh token
    Note over Attacker: Access permanently terminated
```

The diagram makes the security model explicit: **revocation is bounded by the access-token TTL, not instantaneous.** Keeping that TTL short (15 minutes or less) is what makes the design defensible.

## API Responsibilities

### Implemented

| Method | Endpoint              | Auth                   | Purpose                                           |
| ------ | --------------------- | ---------------------- | ------------------------------------------------- |
| `POST` | `/auth/login`         | Public                 | Creates a session as a side effect.               |
| `POST` | `/auth/register`      | Public                 | Creates a session as a side effect.               |
| `POST` | `/auth/refresh-token` | Public (token in body) | Consumes one session, creates its successor.      |
| `POST` | `/auth/logout`        | Authenticated          | Deletes the session matching the presented token. |

### Recommended

| Method   | Endpoint                     | Auth                  | Purpose                                                                                          |
| -------- | ---------------------------- | --------------------- | ------------------------------------------------------------------------------------------------ |
| `GET`    | `/auth/sessions`             | Authenticated         | List own sessions — created, expires, provider, device, IP. Must never return the token itself.  |
| `DELETE` | `/auth/sessions/{id}`        | Authenticated (owner) | Revoke one session. Must verify ownership or it becomes a denial-of-service against other users. |
| `DELETE` | `/auth/sessions`             | Authenticated         | Revoke all sessions except the current one — the standard "sign out everywhere else" control.    |
| `GET`    | `/admin/users/{id}/sessions` | `ADMIN_ROLES`         | Support-facing session inspection.                                                               |
| `DELETE` | `/admin/users/{id}/sessions` | `ADMIN_ROLES`         | Force sign-out during incident response.                                                         |

## Validation Rules

| Rule                                                       | Enforcement                  | Status                                     |
| ---------------------------------------------------------- | ---------------------------- | ------------------------------------------ |
| `refreshToken` must be globally unique                     | DB `@unique`                 | Implemented                                |
| Token signature must verify against `REFRESH_TOKEN_SECRET` | `jwt.verify`                 | Implemented                                |
| A session row must exist for the exact token               | `findValidSession`           | Implemented                                |
| `expiresAt` must be in the future                          | `findValidSession` predicate | Implemented                                |
| `session.userId` must equal the token's `userId` claim     | `AuthSvc.refreshToken`       | Implemented                                |
| Owning user must not be soft-deleted                       | `AuthSvc.refreshToken`       | Implemented                                |
| Owning user must be active                                 | —                            | **NOT IMPLEMENTED**                        |
| Presented token must be single-use                         | Delete-then-issue            | Implemented                                |
| Reuse of a consumed token must revoke the family           | —                            | **NOT IMPLEMENTED**                        |
| `expiresAt` must agree with the JWT's own `exp`            | —                            | **NOT ENFORCED — two independent sources** |
| Session count per user must be capped                      | —                            | **NOT IMPLEMENTED**                        |

## Security Considerations

### Authentication

The session row is the authoritative record of a renewable authentication. Its absence is definitive: no row, no renewal.

### Authorization

`AuthSession` carries no role information. Privilege is resolved from `AuthUser.role` on each request, so a role change takes effect on the next access-token issuance rather than requiring session invalidation. This is a deliberate and correct separation.

### Access control

Any future per-session endpoint **must** verify that the session belongs to the caller. `DELETE /auth/sessions/{id}` without an ownership check is a trivial denial-of-service: any authenticated user could sign out any other.

### Encryption

**Primary weakness of this model.** `refreshToken` is a plaintext, directly replayable credential at rest. Every backup, replica, and query log inherits it.

Recommended: persist `SHA-256(token)`; compare digests on lookup.

### Soft delete

Sessions are **hard-deleted** by design, and this is correct. A soft-deleted session would still be a live credential unless every query remembered to filter it — exactly the class of mistake that causes authentication bypasses. Revocation must be unambiguous.

> This is a deliberate and principled exception to the platform's soft-delete convention.

### Audit logging

Session lifecycle events are **not** currently audited. Recommended additions: session created (with IP and user agent), refresh rotated, logout, administrative force-revocation. These are the primary forensic trail for account-takeover investigations.

### Residual risk

Deleting a session does **not** invalidate access tokens already issued from it. The exposure window equals the remaining access-token TTL. Mitigations: keep the TTL short; for true immediate revocation, maintain a denylist of `jti` values checked at the `authenticate` middleware.

## Performance Considerations

### Indexes

| Index                            | Origin      | Serves                                                      |
| -------------------------------- | ----------- | ----------------------------------------------------------- |
| `auth_sessions_pkey` on `id`     | Primary key | Per-session revocation                                      |
| `auth_sessions_refreshToken_key` | `@unique`   | **The hot path.** Every renewal is an equality lookup here. |
| `auth_sessions_userId_idx`       | `@@index`   | "List my sessions", bulk revocation                         |

**Recommended addition:** `@@index([expiresAt])` to make the cleanup sweep an index range scan rather than a full table scan.

### Query optimization

`findValidSession` filters on `refreshToken` (unique, indexed) plus `expiresAt`. The unique index resolves to at most one row, after which the expiry check is a trivial filter — this query is effectively O(1) and needs no further tuning.

It also `include`s the full `user`, which pulls the password hash into memory on every refresh. Since `AuthSvc.refreshToken` separately calls `findUserById`, this eager include is redundant work on the hot path. **Recommendation:** `select` only `userId` and the fields actually needed.

### Pagination

`GET /auth/sessions` is naturally bounded (single-digit rows) and needs no pagination. The admin equivalent should still cap results defensively.

### Caching

**Do not cache session validity.** The entire purpose of the row is that deleting it takes effect immediately; a cache reintroduces exactly the revocation delay the design exists to eliminate.

### Lazy vs. eager loading

- **Never** eager-load `sessions` from `AuthUser` on general reads. It is unbounded and irrelevant to most requests.
- **Do** eager-load only within `/auth/sessions`.

### Table growth

Unbounded without cleanup. A user rotating hourly generates ~168 rows per week, all but the newest expired. A nightly cron deleting `expiresAt < now()` is required.

## Future Improvements

| #   | Improvement                                             | Priority     | Rationale                                                         |
| --- | ------------------------------------------------------- | ------------ | ----------------------------------------------------------------- |
| 1   | Store `SHA-256(refreshToken)` instead of the token      | **Critical** | Eliminates replayable credentials at rest.                        |
| 2   | Refresh-token reuse detection with family revocation    | **High**     | Converts silent token theft into a detectable, containable event. |
| 3   | Scheduled purge of expired sessions                     | **High**     | Bounds unbounded table growth. `node-cron` is already available.  |
| 4   | Enforce `isActive` on the refresh path                  | **High**     | Suspension must terminate renewal.                                |
| 5   | Derive `expiresAt` from `REFRESH_TOKEN_EXPIRY`          | **High**     | Removes a silent drift bug between JWT and row expiry.            |
| 6   | Add `userAgent`, `ipAddress`, `lastUsedAt`, `revokedAt` | **Medium**   | Prerequisite for a usable session-management UI.                  |
| 7   | `GET`/`DELETE /auth/sessions` endpoints                 | **Medium**   | Standard user-facing security control.                            |
| 8   | Cap concurrent sessions per user                        | **Medium**   | Limits blast radius and curbs credential sharing.                 |
| 9   | Audit session lifecycle events                          | **Medium**   | Forensic trail for takeover investigations.                       |
| 10  | `jti` denylist for immediate access-token revocation    | **Low**      | Closes the residual TTL window when truly required.               |
| 11  | Shorter TTL + mandatory MFA re-auth for admin sessions  | **Low**      | Privileged sessions warrant stricter handling.                    |

## Example Data

### Session created by local login

```json
{
  "userId": "b7a3f1c2-9d4e-4a8b-b1f0-6c2e5d9a3f74",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresAt": "2026-08-14T02:14:33.117Z",
  "provider": "local"
}
```

### Session created by federated login

```json
{
  "userId": "b7a3f1c2-9d4e-4a8b-b1f0-6c2e5d9a3f74",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresAt": "2026-08-14T09:03:51.402Z",
  "provider": "google",
  "providerAvatarUrl": "https://lh3.googleusercontent.com/a/ACg8ocK..."
}
```

### Recommended `GET /auth/sessions` response

Note the token is never exposed:

```json
{
  "sessions": [
    {
      "id": "9c1d4e88-5a72-4f19-8b03-2d6e7f4a1c90",
      "createdAt": "2026-08-07T02:14:33.117Z",
      "expiresAt": "2026-08-14T02:14:33.117Z",
      "provider": "local",
      "current": true
    },
    {
      "id": "4a7b2f31-8e05-4c6d-9f12-7b3c8d5e2a64",
      "createdAt": "2026-08-05T18:42:07.883Z",
      "expiresAt": "2026-08-12T18:42:07.883Z",
      "provider": "google",
      "current": false
    }
  ]
}
```

## Example Database Record

`auth_sessions`

```json
{
  "id": "9c1d4e88-5a72-4f19-8b03-2d6e7f4a1c90",
  "userId": "b7a3f1c2-9d4e-4a8b-b1f0-6c2e5d9a3f74",
  "createdAt": "2026-08-07T02:14:33.117Z",
  "expiresAt": "2026-08-14T02:14:33.117Z",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJiN2EzZjFjMi05ZDRlLTRhOGItYjFmMC02YzJlNWQ5YTNmNzQiLCJqdGkiOiI3ZjNhOWMxZTRiNmQ4YTJmNWM0ZTFkOWIzYTdmMmU4YyIsImlhdCI6MTc3MDQzNTI3MywiZXhwIjoxNzcxMDQwMDczfQ.k3Jm9XpQr2Ts5VwYz8Ab1Cd4Ef7Gh0Ij3Kl6Mn9Op2Q",
  "provider": "local",
  "providerAvatarUrl": null
}
```

## Real World Example

| Platform         | Comparable Design                                                                                                 | Relevance                                                                       |
| ---------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **Google**       | "Your devices" lists every active session with device, location, and last activity, each independently revocable. | The target UX. Requires the device-metadata fields in _Future Improvements #6_. |
| **Shopify**      | Staff sessions are server-tracked and terminated instantly on permission change or removal.                       | Validates enforcing `isActive` on the refresh path.                             |
| **Stripe**       | Dashboard sessions are short-lived with mandatory MFA re-authentication before sensitive operations.              | The model for admin session hardening.                                          |
| **Netflix**      | "Sign out of all devices" is a first-class account control, driven by exactly this one-row-per-session shape.     | Demonstrates bulk revocation as a product feature, not just a security tool.    |
| **Auth0 / Okta** | Refresh-token rotation with automatic reuse detection: replaying a consumed token revokes the entire family.      | The industry-standard behaviour this model is one step away from.               |

## Sequence Diagram

### Concurrent requests during expiry — the client mutex problem

```mermaid
sequenceDiagram
    autonumber
    participant R1 as Request A
    participant R2 as Request B
    participant Cli as Token Manager
    participant API as Auth API
    participant DB as PostgreSQL

    R1->>API: GET /orders (expired access token)
    API-->>R1: 401
    R2->>API: GET /cart (expired access token)
    API-->>R2: 401

    R1->>Cli: refresh needed
    R2->>Cli: refresh needed

    Note over Cli: MUTEX — only one refresh<br/>may be in flight. Both callers<br/>await the same promise.

    Cli->>API: POST /auth/refresh-token (token T1)
    API->>DB: SELECT session WHERE refreshToken=T1
    DB-->>API: found
    API->>DB: DELETE session T1
    API->>DB: INSERT session T2
    API-->>Cli: { accessToken A2, refreshToken T2 }

    Cli-->>R1: A2
    Cli-->>R2: A2
    R1->>API: GET /orders (A2) → 200
    R2->>API: GET /cart (A2) → 200

    Note over Cli,DB: Without the mutex, the second call<br/>would present the already-deleted T1<br/>and receive 401 — logging the user out.
```

### Recommended reuse detection

```mermaid
sequenceDiagram
    autonumber
    participant Attacker
    participant User as Legitimate Client
    participant API as Auth API
    participant DB as PostgreSQL

    Note over Attacker: Has stolen refresh token T1
    User->>API: POST /auth/refresh-token (T1)
    API->>DB: DELETE T1, INSERT T2
    API-->>User: { T2 }

    Attacker->>API: POST /auth/refresh-token (T1)
    API->>DB: SELECT session WHERE refreshToken=T1
    DB-->>API: not found

    rect rgb(95, 30, 30)
    Note over API: TODAY: generic 401.<br/>Indistinguishable from expiry.<br/>Theft goes unnoticed.
    end

    rect rgb(30, 77, 58)
    Note over API,DB: RECOMMENDED: a consumed token was<br/>replayed — treat as theft.<br/>DELETE every session in the family.<br/>Notify the user. Force re-authentication.
    end
```

## Entity Relationship Explanation

```mermaid
erDiagram
    AuthUser ||--o{ AuthSession : "holds"
    AuthSession {
        string id PK
        string userId FK
        string refreshToken UK
        datetime expiresAt
        string provider
        string providerAvatarUrl
    }
```

`AuthSession` is a **leaf entity**: it references `AuthUser` and nothing else, and nothing references it. This isolation is intentional and valuable — sessions can be deleted freely, in bulk, at any time, without any cascade analysis. It is the only table in the schema that can be truncated without consequence beyond forcing re-authentication.

The `provider` field is the sole thematic link to `AuthSocialAccount`, but it is deliberately a **denormalised string, not a foreign key**. A session must survive the unlinking of the social account that created it; coupling them would mean disconnecting Google forcibly signs the user out everywhere.

## Best Practices

1. **Rotate on every refresh.** Already implemented; do not weaken it for client convenience.
2. **Hard-delete sessions.** Revocation must be unambiguous.
3. **Keep access-token TTL short** — it is the true bound on revocation latency.
4. **Serialise client-side refresh behind a mutex**, sharing one in-flight promise.
5. **Never log or return `refreshToken`.** It appears in no API response and must appear in no log line.
6. **Delete all sessions on password change**, forcing re-authentication everywhere.
7. **Derive `expiresAt` and the JWT `exp` from one constant.**
8. **Verify ownership** on any per-session endpoint.
9. **Schedule expired-session cleanup.**
10. **Carry `provider` forward on rotation** — already done; it preserves the session's authentication provenance.

## Common Mistakes

| Mistake                                                      | Consequence                                                           | Correct Approach                                     |
| ------------------------------------------------------------ | --------------------------------------------------------------------- | ---------------------------------------------------- |
| Retrying a failed refresh with the same token                | The token was consumed; the retry hard-fails and logs the user out    | Client-side mutex with a shared promise              |
| Firing parallel refreshes from concurrent 401s               | Only the first succeeds; the rest 401                                 | Same — serialise                                     |
| Storing the refresh token in `localStorage`                  | XSS yields a long-lived credential                                    | `httpOnly` + `Secure` + `SameSite=Strict` cookie     |
| Deleting sessions but forgetting `DEL user:{id}`             | Cached projection keeps serving stale role and status                 | Invalidate cache alongside session deletion          |
| Expecting instant revocation on session delete               | Existing access tokens remain valid until TTL expiry                  | Keep TTL short; add a `jti` denylist if truly needed |
| Soft-deleting sessions                                       | A missed filter turns a "revoked" session back into a live credential | Hard-delete, always                                  |
| Eager-loading `user` on every session lookup                 | Pulls the password hash into memory on the hot path                   | `select` only the required fields                    |
| Treating a `401` on refresh as necessarily "expired"         | Masks token theft as routine expiry                                   | Implement reuse detection                            |
| Changing `REFRESH_TOKEN_EXPIRY` without updating `expiresAt` | Sessions expire early with no obvious cause                           | Single shared constant                               |
| Omitting an ownership check on `DELETE /auth/sessions/{id}`  | Any user can sign out any other user                                  | Verify `session.userId === caller.id`                |

---

---

# AuthSocialAccount

## Overview

`AuthSocialAccount` records a **link between a platform identity and an external identity provider** — Google, Facebook, TikTok, Apple, and so on. Each row asserts: _this `AuthUser` is also this person on that platform, and here are the OAuth credentials we hold for them._

It serves two distinct purposes that are worth separating in your mind:

1. **Authentication** — "sign in with Google."
2. **Authorization delegation** — holding an access token that lets the platform call the provider's API on the user's behalf (publishing a product feed to a Meta catalog, for example).

## Business Purpose

Social login materially increases checkout conversion by removing the password step, and it supplies verified email addresses and profile images at zero friction.

The second purpose matters more for this platform specifically. The Marketing module (`MarketingSocialFeed`, `MarketingSocialAd`) needs to push catalog data to Meta and Google Ads. Those calls require a stored OAuth access token with the right scopes — which is exactly what `accessToken`, `refreshToken`, `expiresAt`, and `scopes` exist to hold.

> **Status:** the model is fully specified but **no code writes to it.** `AuthRepo.getSocialAccounts` reads it; nothing creates or updates rows. There is no OAuth authorization or callback route in `auth.route.ts`. This table is, today, permanently empty.

## Responsibilities

| #   | Responsibility                                                                      |
| --- | ----------------------------------------------------------------------------------- |
| 1   | Map an external provider identity to an internal `AuthUser`                         |
| 2   | Prevent the same provider being linked twice to one user                            |
| 3   | Store the OAuth access token for delegated API calls                                |
| 4   | Store the OAuth refresh token for unattended token renewal                          |
| 5   | Track provider-token expiry independently of platform sessions                      |
| 6   | Record granted scopes so the app can detect insufficient permissions before calling |
| 7   | Cache the provider avatar URL                                                       |
| 8   | Enable credential-less accounts (`AuthUser.password` is null)                       |

## Features

- **Multi-provider linking** — one identity, many providers simultaneously.
- **One account per provider per user**, enforced by `@@unique([userId, platform])`.
- **Provider-side token lifecycle** tracked separately from platform sessions.
- **Scope tracking** for capability detection.
- **Avatar sourcing** without an upload.
- **Passwordless account support.**

## Admin Features

- **View a user's linked providers** during support investigations — a user reporting "I can't log in" is very often a social-only user attempting password login.
- **Diagnose integration failures** by inspecting `expiresAt` and `scopes` when a marketing feed push fails.
- _(Recommended)_ **Force-unlink a compromised provider connection.**

## Customer Features

- **One-click registration and login** via a social provider.
- **Link additional providers** to an existing account.
- **View linked accounts** — `GET /auth/social` (implemented).
- _(Recommended)_ **Unlink a provider**, subject to retaining at least one usable credential.

## Seller Features

Materially more important for sellers than for shoppers. A seller connecting a Meta Business or Google Merchant account is what enables:

- Automated product-catalog feed publication (`MarketingSocialFeed`).
- Programmatic ad creation and performance retrieval (`MarketingSocialAd`).

For this to work the linked account must carry business-level scopes (`catalog_management`, `ads_management`), not consumer login scopes — which is precisely why `scopes` is stored.

## Developer Notes

### The model is currently write-never

No service creates an `AuthSocialAccount`. Implementing the OAuth authorization-code flow is a prerequisite for every feature described here.

### Account linking is the dangerous part

The single most security-critical decision in this model is what happens when someone signs in with Google using an email that already exists as a local account.

| Strategy                                           | Behaviour                                                          | Verdict                                                                                                                                                |
| -------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Auto-link on matching email**                    | Silently attach the provider to the existing account               | **Dangerous.** If the provider does not guarantee a verified email, an attacker registers a provider account with the victim's address and takes over. |
| **Link only if provider asserts `email_verified`** | Attach only on a cryptographically asserted verified email         | **Acceptable** with a trusted provider.                                                                                                                |
| **Require authenticated linking**                  | User must sign in with their existing credentials first, then link | **Safest.** Recommended default.                                                                                                                       |

Never auto-link on an unverified email.

### Token refresh is a background concern

Provider access tokens expire on the provider's schedule — Meta's are typically 60 days. A marketing job that publishes a feed must check `expiresAt` and refresh **before** calling, or the job fails in a way that looks like an API outage rather than an expired credential.

### Unlinking must not lock the user out

If `AuthUser.password` is null and the user unlinks their only social account, they are permanently locked out. Any unlink endpoint must refuse when it would remove the last usable credential.

### Storage of `accessToken` is a live risk

`accessToken` and `refreshToken` are stored in plaintext. These are not platform credentials — they are **live third-party API credentials**, potentially with `ads_management` scope against a real advertising budget. Compromise means an attacker spends the seller's money. These require envelope encryption via a KMS before any production launch.

## Fields Explanation

| Field            | Type            | Purpose                                    | Required | Notes                                                                                                                                                                                                  |
| ---------------- | --------------- | ------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`             | `String` (UUID) | Primary key                                | Yes      | —                                                                                                                                                                                                      |
| `userId`         | `String`        | Owning platform identity                   | Yes      | FK to `AuthUser.id`. Part of the composite unique.                                                                                                                                                     |
| `platform`       | `String`        | Provider name                              | Yes      | E.g. `"google"`, `"facebook"`. **Stringly-typed** — should be an enum for consistency with the rest of the schema. Must be normalised to lowercase or `"Google"` and `"google"` become distinct links. |
| `providerUserId` | `String`        | The user's stable ID at the provider       | Yes      | The real join key to the external system. Not unique in the schema — **see Validation Rules.**                                                                                                         |
| `accessToken`    | `String`        | OAuth access token for delegated API calls | Yes      | **Plaintext. Requires encryption.**                                                                                                                                                                    |
| `refreshToken`   | `String?`       | OAuth refresh token                        | No       | Nullable — not every provider or flow issues one.                                                                                                                                                      |
| `expiresAt`      | `DateTime?`     | Provider access-token expiry               | No       | Must be checked before delegated calls. Independent of `AuthSession.expiresAt`.                                                                                                                        |
| `scopes`         | `String?`       | Granted OAuth scopes                       | No       | Space- or comma-delimited. Enables capability checks before an API call fails.                                                                                                                         |
| `avatarUrl`      | `String?`       | Provider profile image URL                 | No       | Avoids an upload. May become stale.                                                                                                                                                                    |
| `createdAt`      | `DateTime`      | Link establishment time                    | Yes      | —                                                                                                                                                                                                      |
| `updatedAt`      | `DateTime`      | Last token refresh or re-link              | Yes      | Effectively "token last rotated".                                                                                                                                                                      |

## Relationships

| Relation | Cardinality | Target     | Why It Exists                                                                                                                                                     |
| -------- | ----------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `user`   | Many-to-One | `AuthUser` | Each link belongs to one identity. The inverse `AuthUser.socialAccounts` lists a user's providers and determines whether any credential remains before unlinking. |

### Why `@@unique([userId, platform])` and not `[platform, providerUserId]`

The declared constraint stops **one user linking two Google accounts**. It does **not** stop **two users linking the same Google account** — nothing prevents `providerUserId = "google-12345"` appearing on both Maria's and Danilo's rows.

That is an account-takeover vector: an attacker links a victim's provider identity to their own platform account and thereafter signs in as themselves using the victim's Google identity.

**Recommendation:** add `@@unique([platform, providerUserId])` so a given external identity maps to at most one platform user.

## Business Workflow

```
User clicks "Continue with Google"
        ↓
Redirect to provider authorization endpoint (state parameter set)
        ↓
User consents to requested scopes
        ↓
Provider redirects to callback with an authorization code
        ↓
State parameter verified  ← CSRF protection
        ↓
Code exchanged server-side for access + refresh tokens
        ↓
Provider profile fetched (providerUserId, email, avatar, email_verified)
        ↓
        ├─ AuthSocialAccount exists for (platform, providerUserId)?
        │       → tokens updated, proceed to session issuance
        │
        ├─ No link, but an AuthUser exists with that email?
        │       → verified email → link  |  unverified → REJECT
        │
        └─ Neither?
                → create AuthUser (password = null)
                → create AuthSocialAccount
        ↓
AuthSession created with provider = "google", providerAvatarUrl captured
        ↓
Token pair returned to the client
```

## User Journey

**Persona:** Maria, returning via social login.

1. Maria taps "Continue with Google" and is redirected to Google's consent screen.
2. She approves basic profile and email scopes.
3. Google redirects back with an authorization code. The server exchanges it for tokens.
4. Her Google identity is already linked, so the stored tokens are refreshed and she is signed in — **no password involved.**
5. Her avatar is served from `providerAvatarUrl`; she never uploaded one.
6. Months later she tries to sign in with email and password out of habit and receives `Account uses social login`. This message is deliberately distinct from a credential failure because it is actionable guidance, not an information leak.
7. She later sets a password from her account settings, gaining both sign-in paths. **Only now** would unlinking Google be permitted.

## Admin Workflow

**Persona:** Danilo, investigating a failed Meta catalog sync for a seller.

1. He opens the seller's profile and inspects linked providers.
2. He sees `platform = "facebook"`, `expiresAt` in the past.
3. Diagnosis: the provider access token expired and no refresh job renewed it. The sync failure was a credential problem, not an API outage.
4. He checks `scopes` and finds `catalog_management` was never granted — the seller had authorised with consumer login scopes only.
5. Remediation: the seller must re-authorize with business scopes. Danilo triggers a re-link prompt.

```mermaid
sequenceDiagram
    autonumber
    participant Job as Marketing Feed Job
    participant DB as PostgreSQL
    participant Meta as Meta Graph API
    participant Admin

    Job->>DB: SELECT AuthSocialAccount WHERE platform='facebook'
    DB-->>Job: { accessToken, expiresAt, scopes }

    alt expiresAt in the past
        Job->>Meta: POST /oauth/access_token (refresh)
        alt refresh succeeds
            Meta-->>Job: new accessToken
            Job->>DB: UPDATE accessToken, expiresAt
        else refresh fails
            Job->>Admin: alert — re-authorization required
        end
    end

    alt scopes lack catalog_management
        Note over Job: Fail fast. Do not call the API<br/>only to receive a permissions error.
        Job->>Admin: alert — insufficient scopes
    else scopes sufficient
        Job->>Meta: POST /catalog/products (feed payload)
        Meta-->>Job: 200 OK
    end
```

## API Responsibilities

### Implemented

| Method | Endpoint       | Auth          | Purpose                                                                                               |
| ------ | -------------- | ------------- | ----------------------------------------------------------------------------------------------------- |
| `GET`  | `/auth/social` | Authenticated | List the caller's linked accounts. **Must strip `accessToken` and `refreshToken` from the response.** |

### Required to make the model functional

| Method   | Endpoint                            | Auth             | Purpose                                                                           |
| -------- | ----------------------------------- | ---------------- | --------------------------------------------------------------------------------- |
| `GET`    | `/auth/social/{platform}/authorize` | Public           | Begin the authorization-code flow; set and store a `state` value.                 |
| `GET`    | `/auth/social/{platform}/callback`  | Public           | Verify `state`, exchange the code, create or link the account, issue a session.   |
| `POST`   | `/auth/social/{platform}/link`      | Authenticated    | Link a provider to the **already authenticated** account — the safe linking path. |
| `DELETE` | `/auth/social/{platform}`           | Authenticated    | Unlink. Must refuse if it removes the last credential.                            |
| `POST`   | `/auth/social/{platform}/refresh`   | Internal / admin | Force a provider-token refresh.                                                   |
| `GET`    | `/admin/users/{id}/social`          | `ADMIN_ROLES`    | Support-facing inspection, tokens redacted.                                       |

> **Response contract:** no endpoint in this module may ever return `accessToken` or `refreshToken`. They are server-side credentials, not user-facing data.

## Validation Rules

| Rule                                                   | Status                                                              |
| ------------------------------------------------------ | ------------------------------------------------------------------- |
| One account per platform per user                      | **Implemented** — `@@unique([userId, platform])`                    |
| One platform identity maps to at most one user         | **MISSING** — add `@@unique([platform, providerUserId])`            |
| `platform` must be a known provider                    | **Not enforced** — free-form string; should be an enum              |
| `platform` must be lowercased before persistence       | **Not enforced** — casing variants create duplicate links           |
| OAuth `state` must be verified on callback             | **Not implemented** (no callback exists) — CSRF protection          |
| Auto-link only on a provider-verified email            | **Not implemented** — the primary takeover vector                   |
| Unlink must not remove the last credential             | **Not implemented** — would permanently lock out passwordless users |
| `accessToken` must be encrypted at rest                | **Not implemented**                                                 |
| `expiresAt` must be checked before delegated API calls | **Not implemented**                                                 |
| Required scopes must be validated before calling       | **Not implemented**                                                 |

## Security Considerations

### Authentication

Social login delegates credential verification to the provider. The platform must still verify that the callback is genuine: **the `state` parameter is mandatory**, or the flow is open to CSRF-based account injection.

### Authorization

Two separate scope layers must not be confused:

- **Platform authorization** — `AuthUser.role`. Signing in with Google grants no platform privilege beyond `USER`.
- **Provider authorization** — the `scopes` column. Governs what the platform may do _at the provider_.

A user with `role = USER` might hold `ads_management` at Meta. These are orthogonal and must never be conflated.

### Access control

`GET /auth/social` must be scoped to the caller. `AuthRepo.getSocialAccounts(userId)` correctly filters by `userId` — **this is done properly**, and stands in contrast to `getFiles()`, which does not filter at all.

### Encryption

**The most serious risk in this model.** `accessToken` and `refreshToken` are live third-party credentials stored in plaintext, potentially carrying `ads_management` scope against a real advertising budget.

Required: envelope encryption with a KMS-managed data key; decrypt only in memory at call time; never log the decrypted value.

### Soft delete

No soft-delete field, and that is correct. Unlinking must be a hard delete — a "soft-deleted" link still holding a live provider token is a credential that appears revoked but is not.

### Audit logging

Link, unlink, scope change, and token refresh must all be audited. Linking a provider to an account is an authentication-surface change and belongs in the security trail.

## Performance Considerations

### Indexes

| Index                                      | Origin      | Serves                                                                                                                                                   |
| ------------------------------------------ | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth_social_accounts_pkey` on `id`        | Primary key | —                                                                                                                                                        |
| `auth_social_accounts_userId_platform_key` | `@@unique`  | Composite unique. **Also serves `userId`-prefix lookups**, so `GET /auth/social` is already indexed — a separate `@@index([userId])` would be redundant. |

**Required addition:** `@@unique([platform, providerUserId])` — closes the takeover vector _and_ provides the index for the callback's primary lookup ("who is this Google user?"), which is currently a **full table scan**.

**Recommended:** `@@index([expiresAt])` for the token-refresh sweep.

### Query optimization

The OAuth callback's hot lookup is by `(platform, providerUserId)` — precisely the index that does not exist. Every social login would perform a sequential scan. This alone justifies the constraint.

### Pagination

Not required. A user has single-digit linked accounts.

### Caching

**Do not cache access tokens outside the database.** They rotate, and a stale cached token produces confusing authorization failures. If caching is unavoidable, the TTL must be strictly shorter than the shortest `expiresAt`.

### Lazy vs. eager loading

- **Never** eager-load `socialAccounts` on general user reads — it pulls plaintext credentials into memory on every request.
- Load explicitly, only where needed, selecting only non-secret columns.

## Future Improvements

| #   | Improvement                                       | Priority     | Rationale                                                                                 |
| --- | ------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------- |
| 1   | Implement the OAuth authorization + callback flow | **Critical** | The model is inert without it.                                                            |
| 2   | Add `@@unique([platform, providerUserId])`        | **Critical** | Closes an account-takeover vector and fixes a full table scan.                            |
| 3   | Envelope-encrypt `accessToken` / `refreshToken`   | **Critical** | Live third-party credentials with spending power.                                         |
| 4   | Verify `email_verified` before auto-linking       | **Critical** | Primary takeover vector via unverified provider email.                                    |
| 5   | Mandatory `state` verification on callback        | **High**     | CSRF protection.                                                                          |
| 6   | Refuse unlink when it removes the last credential | **High**     | Prevents permanent lockout.                                                               |
| 7   | Convert `platform` to an enum                     | **High**     | Consistency; eliminates casing-variant duplicates.                                        |
| 8   | Background provider-token refresh job             | **High**     | Marketing integrations fail silently otherwise.                                           |
| 9   | Scope validation before delegated API calls       | **Medium**   | Fail fast with an actionable error.                                                       |
| 10  | Audit link/unlink/scope changes                   | **Medium**   | Authentication-surface changes belong in the security trail.                              |
| 11  | Support multiple accounts per platform            | **Low**      | A seller may manage several Meta Business accounts. Requires relaxing the current unique. |
| 12  | Periodic avatar re-sync                           | **Low**      | `avatarUrl` goes stale.                                                                   |

## Example Data

### Consumer login link

```json
{
  "userId": "b7a3f1c2-9d4e-4a8b-b1f0-6c2e5d9a3f74",
  "platform": "google",
  "providerUserId": "112893746650192834710",
  "accessToken": "ya29.a0AfH6SMBx7...",
  "refreshToken": "1//0eXk9_Lm2Qp...",
  "expiresAt": "2026-08-07T03:14:33.000Z",
  "scopes": "openid email profile",
  "avatarUrl": "https://lh3.googleusercontent.com/a/ACg8ocK..."
}
```

### Seller business link with catalog scopes

```json
{
  "userId": "e2c88a41-7f13-4c2d-9b55-0af3d6e91c28",
  "platform": "facebook",
  "providerUserId": "10159384756201938",
  "accessToken": "EAAGm0PX4ZCpsBA...",
  "refreshToken": null,
  "expiresAt": "2026-10-06T08:02:19.000Z",
  "scopes": "email public_profile catalog_management ads_management business_management",
  "avatarUrl": "https://platform-lookaside.fbsbx.com/platform/profilepic/..."
}
```

> Note `refreshToken` is `null` — Meta issues long-lived (~60 day) tokens exchanged rather than refreshed, which is exactly why the field is nullable.

### Safe `GET /auth/social` response

```json
{
  "accounts": [
    {
      "platform": "google",
      "avatarUrl": "https://lh3.googleusercontent.com/a/ACg8ocK...",
      "linkedAt": "2026-07-22T09:41:02.884Z",
      "expiresAt": "2026-08-07T03:14:33.000Z",
      "scopes": ["openid", "email", "profile"]
    }
  ]
}
```

**Tokens are absent. This is mandatory.**

## Example Database Record

`auth_social_accounts`

```json
{
  "id": "7d2e9b14-3c58-4a06-8e71-9f4b2d6c1a83",
  "userId": "b7a3f1c2-9d4e-4a8b-b1f0-6c2e5d9a3f74",
  "platform": "google",
  "providerUserId": "112893746650192834710",
  "accessToken": "ya29.a0AfH6SMBx7kQ2mNp9vR4tY8wZ1aB3cD5eF7gH0iJ2kL4mN6oP8qR",
  "refreshToken": "1//0eXk9_Lm2QpRsTuVwXyZ-AbCdEfGhIjKlMnOpQrStUvWxYz",
  "expiresAt": "2026-08-07T03:14:33.000Z",
  "scopes": "openid email profile",
  "avatarUrl": "https://lh3.googleusercontent.com/a/ACg8ocKm2Np9vR4t=s96-c",
  "createdAt": "2026-07-22T09:41:02.884Z",
  "updatedAt": "2026-08-07T02:14:33.117Z"
}
```

## Real World Example

| Platform            | Comparable Design                                                                                                                                                 | Relevance                                                                                                      |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Shopify**         | Merchants connect Facebook and Google channels; Shopify stores the OAuth grant and pushes catalog data. Expired grants surface as an explicit "reconnect" banner. | Exactly this model's seller use case. The visible reconnect prompt is the right UX for an expired `expiresAt`. |
| **Amazon**          | "Login with Amazon" is a distinct product from an Amazon retail account, with independently managed scopes.                                                       | Reinforces separating platform role from provider scopes.                                                      |
| **Lazada / Shopee** | Sellers link Facebook Business accounts for catalog and ad sync; token expiry is a routine seller-support issue.                                                  | Confirms the operational need for the background refresh job.                                                  |
| **Stripe Connect**  | Stores delegated OAuth credentials for connected accounts, encrypted, with explicit scope tracking.                                                               | The security bar for storing third-party credentials — envelope encryption, never plaintext.                   |
| **Google / Apple**  | Both require a verified email assertion before any account linkage; Apple additionally offers relay addresses.                                                    | Validates _Future Improvements #4_: never auto-link on an unverified email.                                    |

## Sequence Diagram

### Full OAuth authorization-code flow (recommended implementation)

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant C as Client
    participant API as Platform API
    participant P as Provider (Google)
    participant DB as PostgreSQL

    U->>C: Click "Continue with Google"
    C->>API: GET /auth/social/google/authorize
    API->>API: generate + store `state`
    API-->>C: 302 to provider consent URL
    C->>P: authorization request
    P->>U: consent screen
    U->>P: approve scopes
    P-->>C: 302 to callback?code=...&state=...
    C->>API: GET /auth/social/google/callback

    API->>API: verify `state`
    alt state mismatch
        API-->>C: 400 — possible CSRF
    end

    API->>P: exchange code for tokens
    P-->>API: { access_token, refresh_token, expires_in, scope }
    API->>P: GET /userinfo
    P-->>API: { sub, email, email_verified, picture }

    API->>DB: SELECT WHERE platform='google' AND providerUserId=sub

    alt link exists
        API->>DB: UPDATE tokens, expiresAt, scopes
    else no link, email matches an AuthUser
        alt email_verified = true
            API->>DB: INSERT AuthSocialAccount linked to existing user
        else email_verified = false
            Note over API: REJECT — takeover vector
            API-->>C: 403 — verify email with provider first
        end
    else no link, no user
        API->>DB: INSERT AuthUser (password = NULL)
        API->>DB: INSERT AuthSocialAccount
    end

    API->>DB: INSERT AuthSession (provider='google', providerAvatarUrl=picture)
    API-->>C: { accessToken, refreshToken, user }
```

### Unlink guard

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant API as Platform API
    participant DB as PostgreSQL

    U->>API: DELETE /auth/social/google
    API->>DB: SELECT password FROM auth_users WHERE id=?
    API->>DB: SELECT count(*) FROM auth_social_accounts WHERE userId=?

    alt password IS NULL AND linked accounts = 1
        Note over API: Unlinking would remove the<br/>ONLY credential — permanent lockout.
        API-->>U: 409 — set a password first
    else another credential remains
        API->>DB: DELETE FROM auth_social_accounts WHERE userId=? AND platform='google'
        API->>DB: DELETE sessions WHERE provider='google' AND userId=?
        API-->>U: 200 — unlinked
    end
```

## Entity Relationship Explanation

```mermaid
erDiagram
    AuthUser ||--o{ AuthSocialAccount : "federates via"
    AuthSocialAccount {
        string id PK
        string userId FK
        string platform
        string providerUserId
        string accessToken
        string refreshToken
        datetime expiresAt
        string scopes
        string avatarUrl
    }
    AuthSocialAccount }|..|| MarketingSocialFeed : "supplies credentials for"
    AuthSocialAccount }|..|| MarketingSocialAd : "supplies credentials for"
```

Structurally `AuthSocialAccount` is a leaf hanging off `AuthUser`, with no outbound foreign keys.

Its **logical** reach is far wider than its schema. `MarketingSocialFeed` and `MarketingSocialAd` cannot function without the OAuth credentials stored here, yet no foreign key expresses that dependency — the relationship is resolved in application code at job execution time. This is a deliberate decoupling (a marketing feed configuration should survive a temporary credential problem), but it means **the dependency is invisible in the ER diagram and easy to overlook.** Anyone working on the Marketing module must know this table exists.

## Best Practices

1. **Always verify the `state` parameter** on callback.
2. **Never auto-link on an unverified provider email.**
3. **Prefer authenticated linking** — sign in first, then link.
4. **Encrypt provider tokens at rest** with envelope encryption.
5. **Never return tokens** from any endpoint.
6. **Normalise `platform` to lowercase**, ideally via an enum.
7. **Store `providerUserId`, not the email, as the join key** — emails change; provider subject IDs do not.
8. **Check `expiresAt` before every delegated call** and refresh proactively.
9. **Validate scopes before calling**, failing with an actionable error.
10. **Guard unlink against last-credential removal.**
11. **Hard-delete on unlink**, and revoke the token at the provider too.

## Common Mistakes

| Mistake                                                                     | Consequence                                               | Correct Approach                                   |
| --------------------------------------------------------------------------- | --------------------------------------------------------- | -------------------------------------------------- |
| Auto-linking on matching email without verification                         | Full account takeover                                     | Require `email_verified`, or authenticated linking |
| Omitting `state` verification                                               | CSRF-based account injection                              | Generate, store, and verify `state`                |
| Using email as the provider join key                                        | Users change emails; links break or mis-attach            | Join on `providerUserId`                           |
| Returning `accessToken` in an API response                                  | Leaks a live third-party credential to the browser        | Strip tokens from every projection                 |
| Storing tokens in plaintext                                                 | Database compromise yields spending power at the provider | Envelope-encrypt via KMS                           |
| Allowing unlink of the last credential                                      | Permanent, unrecoverable lockout                          | Guard the unlink path                              |
| Assuming `refreshToken` is always present                                   | Null-pointer on Meta-style long-lived tokens              | Treat as nullable; branch on provider              |
| Calling the provider without checking `expiresAt`                           | Failures look like API outages, not expired credentials   | Proactive refresh                                  |
| Confusing provider scopes with platform roles                               | Privilege-escalation reasoning errors                     | Keep the two authorization planes distinct         |
| Eager-loading `socialAccounts` on user reads                                | Plaintext credentials pulled into memory on every request | Load explicitly, select non-secret columns         |
| Assuming `@@unique([userId, platform])` prevents shared provider identities | Two users can link the same Google account                | Add `@@unique([platform, providerUserId])`         |

---

---

# AuthFile

## Overview

`AuthFile` is the **platform-wide file registry**. Every uploaded binary asset — product photography, user avatars, CMS banners, ad creatives, supplier imagery — is registered here as a single row carrying its URL, MIME type, size, and arbitrary metadata.

Despite the `Auth` prefix (a naming artefact of the boilerplate this project grew from), it is **not an authentication model.** It is a shared infrastructure model consumed by eight different domains.

## Business Purpose

The model exists to provide **one canonical asset registry** rather than scattering URL strings across a dozen tables.

Concretely, it enables:

- **Deduplication** — one physical file referenced by many entities. A single lifestyle photograph can serve as a product image, a collection hero, and a CMS banner without three uploads.
- **Lifecycle management** — soft deletion via `deletedAt`, so removing an asset does not shatter every entity that displays it.
- **Governance** — MIME type and size are recorded, making it possible to audit what is stored and enforce policy.
- **Storage abstraction** — consumers hold a `fileId`; migrating from local disk to S3 or a CDN changes `fileUrl` in one table rather than rewriting every consumer.

## Responsibilities

| #   | Responsibility                                                             |
| --- | -------------------------------------------------------------------------- |
| 1   | Register every uploaded asset with a stable, referenceable identity        |
| 2   | Store the resolvable public URL                                            |
| 3   | Record MIME type for rendering and validation decisions                    |
| 4   | Record byte size for quota and reporting                                   |
| 5   | Support soft deletion without breaking referring entities                  |
| 6   | Carry arbitrary structured metadata (dimensions, alt text, EXIF, CDN keys) |
| 7   | Serve as the shared target for eight consumer relations                    |
| 8   | Decouple consumers from the physical storage backend                       |

## Features

- **Polymorphic reuse** across eight distinct consumer domains.
- **Any media type** — images, GIFs, video, audio, documents, archives (mirroring the `MediaType` enum used by `CatalogProductMedia`).
- **Soft deletion** via `deletedAt`.
- **Extensible metadata** through a JSON column.
- **Storage-agnostic addressing.**
- **Safe detachment** — every consumer FK uses `onDelete: SetNull`, so removing a file nulls the reference rather than cascading a delete into a product.

### Consumer Domains

| Consumer                | Relation                                      | Asset Role                     |
| ----------------------- | --------------------------------------------- | ------------------------------ |
| `AuthUser`              | `users` (named `UserAvatar`)                  | Profile picture                |
| `CatalogProductMedia`   | `productMedia`                                | Product and variant imagery    |
| `MarketingSocialAd`     | `socialAds`                                   | Ad creative (image or video)   |
| `CatalogCollection`     | `collections` (`CollectionImageFile`)         | Collection hero image          |
| `CatalogCollectionItem` | `collectionItems` (`CollectionItemImageFile`) | Per-slot override image        |
| `SupplierProductImage`  | `supplierProductImages`                       | Supplier-sourced product photo |
| `SupplierVariantImage`  | `supplierVariantImages`                       | Supplier-sourced variant photo |
| `CmsBanner`             | `cmsBanners` (`BannerImageFile`)              | Storefront banner              |

## Admin Features

- **Browse the asset library** — `GET /auth/files` _(currently unscoped — see Security Considerations)_.
- **Upload assets** — `POST /upload`.
- **Soft-delete assets** by setting `deletedAt`, safely detaching them from consumers.
- **Audit storage consumption** by aggregating `fileSize`.
- **Enforce media policy** by inspecting `mimeType` distribution.

## Customer Features

- **Upload an avatar**, referenced through `AuthUser.avatarId`.
- **Upload review images** — though note `ReviewImage` stores a raw `url` string and does **not** reference `AuthFile`, an inconsistency flagged below.
- **Consume assets** implicitly whenever browsing products, banners, or collections.

## Seller Features

- **Upload product media** for their catalog listings.
- **Upload ad creatives** for `MarketingSocialAd`.
- **Reuse a single asset** across multiple products, collections, and campaigns without re-uploading.

## Developer Notes

### The upload route does not create `AuthFile` rows

This is the most important implementation fact in this model.

`src/routes/fileUpload.route.ts` accepts a multipart upload via multer, logs it, and returns the file's name, size, and MIME type. It **never writes to the database.** No `AuthFile` row is created, and no `fileUrl` is returned.

The consequence: **the upload endpoint and the file registry are entirely disconnected.** There is currently no code path that populates `AuthFile`. Any consumer wanting a `fileId` has no supported way to obtain one.

Making this model functional requires the upload handler to persist the storage result and return the created `AuthFile`.

### The route is also unauthenticated

`POST /upload` has **no `authenticate` middleware**. Any anonymous caller on the internet can upload arbitrary files to the server. Combined with the absence of MIME allow-listing or size caps at the route level, this is a storage-exhaustion and malicious-upload vector that must be closed before any public deployment.

### Nullable fields that should not be

`filename` and `fileUrl` are both optional. A row with neither is schema-valid and completely useless — it identifies no asset and resolves to nothing. `fileUrl` in particular is the entire point of the record. Both should be required.

### `ReviewImage` bypasses this model

`ReviewImage` stores a plain `url String` with no `fileId`. Customer review photos therefore sit outside the registry entirely: no soft deletion, no MIME governance, no size accounting. This is a genuine modelling inconsistency and should be reconciled by giving `ReviewImage` an optional `fileId`.

### Soft delete is not enforced on read

`deletedAt` exists, but `AuthRepo.getFiles()` does not filter on it. Deleted files will be returned by the listing endpoint. Every read path must add `where: { deletedAt: null }`.

### Orphan accumulation

Because every consumer uses `onDelete: SetNull`, deleting an `AuthFile` row leaves consumers intact with a null reference. The inverse case — an `AuthFile` referenced by nothing — accumulates silently. A reconciliation job should identify unreferenced, soft-deleted files and purge the underlying storage objects, or storage costs grow without bound.

## Fields Explanation

| Field       | Type            | Purpose                                       | Required | Notes                                                                                                                             |
| ----------- | --------------- | --------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `id`        | `String` (UUID) | Primary key; the handle every consumer stores | Yes      | The stable reference that decouples consumers from storage.                                                                       |
| `filename`  | `String?`       | Original uploaded filename                    | No       | **Should be required.** Used for download naming and admin display. Must never be trusted as a path — sanitise against traversal. |
| `fileUrl`   | `String?`       | Resolvable public URL                         | No       | **Should be required** — a file record without a URL is meaningless. The single point of change when migrating storage backends.  |
| `mimeType`  | `String?`       | IANA media type                               | No       | E.g. `image/jpeg`, `video/mp4`. Must be derived from content inspection, not from the client-supplied header.                     |
| `fileSize`  | `Int?`          | Size in bytes                                 | No       | `Int` caps at ~2.1 GB. Adequate for images; **insufficient for large video** — consider `BigInt` if video is in scope.            |
| `createdAt` | `DateTime`      | Upload timestamp                              | Yes      | —                                                                                                                                 |
| `updatedAt` | `DateTime`      | Last modification                             | Yes      | Changes on metadata edits or replacement.                                                                                         |
| `deletedAt` | `DateTime?`     | Soft-deletion timestamp                       | No       | `null` means live. **Must be filtered on every read — currently is not.**                                                         |
| `metaData`  | `Json?`         | Arbitrary structured metadata                 | No       | Dimensions, alt text, EXIF, CDN keys, transcoding variants. Unindexed — use a GIN index if it is ever queried.                    |

## Relationships

All eight relations are **One-to-Many from `AuthFile`'s perspective**: one file, many referring entities. From each consumer's side it is Many-to-One and optional.

| Relation                | Consumer                | Cardinality | Why It Exists                                                                                                                    |
| ----------------------- | ----------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `users`                 | `AuthUser`              | 1:N         | Avatars reuse the shared file subsystem, inheriting CDN handling and lifecycle management rather than duplicating upload logic.  |
| `productMedia`          | `CatalogProductMedia`   | 1:N         | The primary commerce use case. `CatalogProductMedia` adds ordering, alt text, and primary-flag semantics on top of the raw file. |
| `socialAds`             | `MarketingSocialAd`     | 1:N         | Ad creatives are files; reusing a product photograph as an ad creative requires no duplication.                                  |
| `collections`           | `CatalogCollection`     | 1:N         | Collection hero imagery.                                                                                                         |
| `collectionItems`       | `CatalogCollectionItem` | 1:N         | Per-slot image override within a collection.                                                                                     |
| `supplierProductImages` | `SupplierProductImage`  | 1:N         | Lets supplier imagery be mirrored into platform-controlled storage rather than hot-linked from a supplier CDN that may vanish.   |
| `supplierVariantImages` | `SupplierVariantImage`  | 1:N         | As above, at variant granularity.                                                                                                |
| `cmsBanners`            | `CmsBanner`             | 1:N         | Storefront banner imagery.                                                                                                       |

### Why every consumer uses `onDelete: SetNull`

This is a deliberate and correct choice. If `CatalogProductMedia.fileId` cascaded, deleting one file would delete the media row — and depending on further cascades, potentially damage the product listing. `SetNull` degrades gracefully: the reference is cleared, the consumer survives, and the UI falls back to a placeholder.

> Contrast with `CatalogProductMedia.productId`, which **does** cascade — because a media row genuinely has no meaning without its product. The distinction is between _ownership_ (cascade) and _reference_ (set null).

## Business Workflow

```
Actor selects a file in the admin UI or storefront
        ↓
POST /upload (multipart/form-data)
        ↓
Multer receives the buffer
        ↓
   ── REQUIRED, NOT YET IMPLEMENTED ──
Authenticate the caller
Validate MIME by content inspection, not header
Enforce size limit
Persist to object storage (S3 / CDN)
Create AuthFile row { filename, fileUrl, mimeType, fileSize, metaData }
Return the created AuthFile including its id
        ↓
Client receives fileId
        ↓
fileId attached to a consumer:
  AuthUser.avatarId | CatalogProductMedia.fileId
  CmsBanner.imageFileId | CatalogCollection.imageFileId | ...
        ↓
Storefront renders fileUrl (ideally via CDN)
        ↓
   ── deletion ──
Admin soft-deletes → deletedAt = now()
        ↓
Reads filter deletedAt IS NULL → asset disappears from listings
Consumers retain the reference; UI falls back to placeholder
        ↓
Reconciliation job purges storage objects for
files that are soft-deleted AND referenced by nothing
```

## User Journey

**Persona:** Maria setting a profile picture.

1. Maria opens account settings and selects a JPEG from her phone.
2. The client uploads it to `POST /upload`.
3. _(Target behaviour)_ The server validates it as a real image, stores it in S3, creates an `AuthFile`, and returns `{ id, fileUrl }`.
4. The client sends `PATCH /users/me { avatarId }`.
5. Her avatar now renders across every storefront — identity is platform-wide, so one upload serves all verticals.
6. She later replaces it. The old `AuthFile` is soft-deleted; `avatarId` repoints. Historical audit records referencing the old file remain intact.

**Persona:** Danilo curating a seasonal campaign.

1. He uploads one hero photograph.
2. He attaches the resulting `fileId` to a `CmsBanner`, a `CatalogCollection` hero, and a `MarketingSocialAd` creative.
3. **One physical asset, three consumers, one storage object.** This reuse is the model's central value.

## Admin Workflow

```mermaid
sequenceDiagram
    autonumber
    participant Admin
    participant API as POST /upload
    participant MW as Auth + Validation
    participant S3 as Object Storage
    participant DB as PostgreSQL

    Admin->>API: multipart file
    API->>MW: authenticate (MISSING TODAY)
    MW-->>API: identity established

    API->>MW: inspect magic bytes, verify MIME
    alt disallowed type or oversized
        API-->>Admin: 400 — rejected
    end

    API->>S3: PUT object
    S3-->>API: { url, key }
    API->>DB: INSERT auth_files { filename, fileUrl, mimeType, fileSize, metaData }
    DB-->>API: AuthFile { id }
    API-->>Admin: 201 { id, fileUrl }

    Admin->>DB: attach fileId to CmsBanner / Collection / Ad
    Note over Admin,DB: One asset, many consumers.
```

## API Responsibilities

### Implemented

| Method | Endpoint      | Auth                    | Purpose                                                  |
| ------ | ------------- | ----------------------- | -------------------------------------------------------- |
| `POST` | `/upload`     | **NONE — critical gap** | Accepts a file. Does not persist an `AuthFile`.          |
| `GET`  | `/auth/files` | Authenticated           | Returns 10 arbitrary files. **Unscoped — critical gap.** |

### Recommended

| Method   | Endpoint            | Auth          | Purpose                                                                        |
| -------- | ------------------- | ------------- | ------------------------------------------------------------------------------ |
| `POST`   | `/files`            | Authenticated | Upload, validate, store, persist, return the `AuthFile`.                       |
| `GET`    | `/files`            | `ADMIN_ROLES` | Paginated library with `mimeType` and date filters; must exclude soft-deleted. |
| `GET`    | `/files/{id}`       | Authenticated | Fetch one file's metadata.                                                     |
| `PATCH`  | `/files/{id}`       | `ADMIN_ROLES` | Update `filename` or `metaData` (alt text).                                    |
| `DELETE` | `/files/{id}`       | `ADMIN_ROLES` | Soft-delete: set `deletedAt`.                                                  |
| `GET`    | `/files/{id}/usage` | `ADMIN_ROLES` | List every consumer referencing this file — essential before deletion.         |
| `POST`   | `/files/bulk`       | `ADMIN_ROLES` | Multi-file upload for catalog onboarding.                                      |

## Validation Rules

| Rule                                                               | Status                                                              |
| ------------------------------------------------------------------ | ------------------------------------------------------------------- |
| Caller must be authenticated                                       | **NOT IMPLEMENTED — route is public**                               |
| MIME type must be on an allow-list                                 | **NOT IMPLEMENTED**                                                 |
| MIME must be verified by content inspection, not the client header | **NOT IMPLEMENTED** — header spoofing permits disguised executables |
| File size must be capped                                           | **Verify multer config**                                            |
| `filename` must be sanitised against path traversal                | **NOT IMPLEMENTED**                                                 |
| `fileUrl` must be present                                          | **NOT ENFORCED — field is nullable**                                |
| `filename` must be present                                         | **NOT ENFORCED — field is nullable**                                |
| Reads must exclude `deletedAt IS NOT NULL`                         | **NOT IMPLEMENTED**                                                 |
| Per-user or per-tenant storage quota                               | **NOT IMPLEMENTED**                                                 |
| Uploaded images should be virus-scanned                            | **NOT IMPLEMENTED**                                                 |

## Security Considerations

### Authentication

**`POST /upload` is unauthenticated.** Any anonymous internet caller may upload arbitrary content. This is the single most severe finding in Module 1 and must be fixed before deployment.

### Authorization

**`GET /auth/files` performs no filtering whatsoever.** The query is `findMany({ take: 10 })` — no `where`, no ownership check, no tenant scope. Any authenticated user, including a shopper who registered seconds ago, receives ten arbitrary file records spanning every tenant on the platform.

Because `AuthFile` is intentionally platform-wide and shared across all tenants, this is simultaneously a horizontal privilege escalation **and** a cross-tenant data exposure. It must be scoped to the caller's own files or restricted to `ADMIN_ROLES`.

### Access control

`AuthFile` has no owner column. There is no `uploadedBy`, no `tenantId`. It is therefore **impossible to express "files I uploaded"** — the data needed to authorize a scoped listing does not exist. Adding `uploadedByUserId` is a prerequisite for fixing the endpoint above properly.

### Encryption

Files themselves live in external storage. Requirements: server-side encryption at rest on the bucket; TLS in transit; **no public bucket listing**; time-limited signed URLs for any private asset. Product imagery is public by nature, but invoices or supplier contracts stored through the same registry are not.

### Malicious upload vectors

| Vector                                       | Mitigation                                            |
| -------------------------------------------- | ----------------------------------------------------- |
| Disguised executable (`.exe` renamed `.jpg`) | Validate magic bytes, not the header                  |
| SVG containing embedded JavaScript           | Exclude SVG from the allow-list, or sanitise it       |
| Decompression bomb (zip/image)               | Enforce size and dimension caps pre-decode            |
| Path traversal via `filename`                | Sanitise; never use the client name as a storage path |
| Storage exhaustion                           | Authenticate, rate-limit, enforce quotas              |
| Stored XSS via `filename` rendered unescaped | Escape on output                                      |

### Soft delete

`deletedAt` is correct in principle and unenforced in practice. Every read path must filter it. Additionally, soft-deleting the database row does **not** remove the object from storage — the asset remains publicly fetchable at its URL by anyone who recorded it. For genuine takedown, storage deletion is also required.

### Audit logging

Upload, metadata edit, and deletion should all be audited, capturing actor and file ID. For a platform where assets carry brand and legal exposure, "who uploaded this and when" is a routine compliance question.

## Performance Considerations

### Indexes

`AuthFile` declares **no indexes beyond its primary key.**

| Proposed Index                | Justification                                                                          |
| ----------------------------- | -------------------------------------------------------------------------------------- |
| `@@index([deletedAt])`        | Every read should filter this; a partial index `WHERE "deletedAt" IS NULL` is optimal. |
| `@@index([createdAt])`        | Library listings sort newest-first.                                                    |
| `@@index([mimeType])`         | Filtering to images or video in the admin library.                                     |
| `@@index([uploadedByUserId])` | Once the owner column exists — required for scoped listings.                           |

Consumer-side FK indexes (`CatalogProductMedia.fileId`, `CmsBanner.imageFileId`, and so on) **are** declared, so joins from consumer to file are efficient. The gap is querying the file table directly.

### Query optimization

`GET /auth/files` currently uses `take: 10` with no ordering. Without an `ORDER BY`, PostgreSQL may return **different rows on identical requests** — the result is non-deterministic. Any listing endpoint requires an explicit, indexed sort key.

### Pagination

Mandatory. An asset library grows without bound. Keyset pagination on `createdAt` is preferred over offset.

### Caching

The assets themselves should be served through a CDN with long `Cache-Control` lifetimes and content-hashed URLs, so replacing an image busts the cache naturally. The `AuthFile` **metadata** rows are small and rarely change — cacheable in Redis, but low value compared to CDN-fronting the binaries.

### Lazy vs. eager loading

- **Eager-load** `avatar` on `/users/me` — one indexed join, immediately needed.
- **Eager-load** `file` when listing `CatalogProductMedia` for a product page.
- **Never** eager-load the inverse collections (`productMedia`, `cmsBanners`, …) from an `AuthFile`. A single widely reused asset could pull thousands of consumer rows. Query the consumer side instead.

### Storage growth

Nothing purges storage. Soft-deleted and never-referenced files accumulate indefinitely. A reconciliation job is required.

## Future Improvements

| #   | Improvement                                     | Priority     | Rationale                                                       |
| --- | ----------------------------------------------- | ------------ | --------------------------------------------------------------- |
| 1   | Authenticate `POST /upload`                     | **Critical** | Currently open to anonymous internet upload.                    |
| 2   | Scope or restrict `GET /auth/files`             | **Critical** | Cross-tenant exposure to any authenticated user.                |
| 3   | Persist an `AuthFile` on upload and return it   | **Critical** | The registry is unreachable; no consumer can obtain a `fileId`. |
| 4   | Content-based MIME validation + allow-list      | **Critical** | Header-trusting uploads permit disguised executables.           |
| 5   | Add `uploadedByUserId`                          | **High**     | Prerequisite for ownership-scoped authorization.                |
| 6   | Make `fileUrl` and `filename` required          | **High**     | A row without a URL is meaningless.                             |
| 7   | Filter `deletedAt` on every read                | **High**     | Soft delete is currently decorative.                            |
| 8   | Add the four indexes above                      | **High**     | The table has none beyond its PK.                               |
| 9   | Deterministic ordering + pagination on listings | **High**     | Current results are non-deterministic.                          |
| 10  | Storage reconciliation and purge job            | **Medium**   | Bounds unbounded storage cost.                                  |
| 11  | Give `ReviewImage` a `fileId`                   | **Medium**   | Brings review photos into the registry.                         |
| 12  | Image variant generation (thumbnail, WebP/AVIF) | **Medium**   | Major storefront performance win.                               |
| 13  | `GET /files/{id}/usage` endpoint                | **Medium**   | Prevents deleting an in-use asset unknowingly.                  |
| 14  | Virus scanning on upload                        | **Medium**   | Standard for user-supplied content.                             |
| 15  | Per-tenant storage quotas                       | **Low**      | Cost control in a multi-tenant platform.                        |
| 16  | `fileSize` to `BigInt`                          | **Low**      | `Int` caps at ~2.1 GB; inadequate for video.                    |
| 17  | Rename the model to `PlatformFile`              | **Low**      | The `Auth` prefix actively misleads; it is not an auth model.   |

## Example Data

### Upload response (target behaviour)

```json
{
  "id": "3f9c1e77-2b64-4d51-9a0e-8c7f2d1b6e45",
  "filename": "summer-collection-hero.jpg",
  "fileUrl": "https://cdn.example.com/files/2026/08/3f9c1e77-summer-collection-hero.jpg",
  "mimeType": "image/jpeg",
  "fileSize": 842713,
  "createdAt": "2026-08-07T10:22:41.006Z",
  "metaData": {
    "width": 2400,
    "height": 1350,
    "altText": "Model wearing the 2026 summer linen collection",
    "storageKey": "files/2026/08/3f9c1e77-summer-collection-hero.jpg",
    "checksum": "sha256:9f2b8c1d4e6a3f7b0c5d8e2a1b4f7c9d3e6a8b2c5f1d4e7a0b3c6d9e2f5a8b1c"
  }
}
```

### Video ad creative

```json
{
  "id": "8b4d2a19-6f37-4e82-a1c5-3d9e7b0f2c68",
  "filename": "summer-sale-15s.mp4",
  "fileUrl": "https://cdn.example.com/files/2026/08/8b4d2a19-summer-sale-15s.mp4",
  "mimeType": "video/mp4",
  "fileSize": 14238905,
  "metaData": {
    "durationSeconds": 15,
    "width": 1080,
    "height": 1920,
    "aspectRatio": "9:16",
    "codec": "h264",
    "purpose": "meta-reels-ad"
  }
}
```

### Soft-deleted asset

```json
{
  "id": "c7e1f4a8-9b2d-4c56-8e03-1f7a5d2b9c84",
  "filename": "spring-banner-deprecated.png",
  "fileUrl": "https://cdn.example.com/files/2026/03/c7e1f4a8-spring-banner.png",
  "mimeType": "image/png",
  "fileSize": 512340,
  "deletedAt": "2026-08-01T00:00:00.000Z",
  "metaData": { "supersededBy": "3f9c1e77-2b64-4d51-9a0e-8c7f2d1b6e45" }
}
```

## Example Database Record

`auth_files`

```json
{
  "id": "3f9c1e77-2b64-4d51-9a0e-8c7f2d1b6e45",
  "filename": "maria-avatar.jpg",
  "fileUrl": "https://cdn.example.com/files/avatars/3f9c1e77-maria-avatar.jpg",
  "mimeType": "image/jpeg",
  "fileSize": 84213,
  "createdAt": "2026-07-22T09:44:18.552Z",
  "updatedAt": "2026-07-22T09:44:18.552Z",
  "deletedAt": null,
  "metaData": {
    "width": 512,
    "height": 512,
    "altText": "Profile photo",
    "storageKey": "files/avatars/3f9c1e77-maria-avatar.jpg",
    "variants": {
      "thumb": "https://cdn.example.com/files/avatars/3f9c1e77-maria-avatar-64.webp",
      "medium": "https://cdn.example.com/files/avatars/3f9c1e77-maria-avatar-256.webp"
    }
  }
}
```

## Real World Example

| Platform                | Comparable Design                                                                                                                                      | Relevance                                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| **Shopify**             | The Files section is a single account-wide library. One asset attaches to products, pages, and themes; automatic CDN variants are generated on upload. | Precisely this model's intent, including the variant generation recommended above.                                |
| **Amazon**              | Product imagery is validated on ingest for dimensions, background, and format; non-compliant images are rejected outright.                             | Argues for strict server-side validation rather than accepting whatever is uploaded.                              |
| **Contentful / Strapi** | Headless CMS platforms model an `Asset` entity referenced by ID across all content types — never an inline URL string.                                 | Validates the `fileId`-reference pattern over storing raw URLs, and highlights why `ReviewImage` is inconsistent. |
| **Cloudinary / imgix**  | Transformation-on-demand: one master asset, derivatives generated from URL parameters.                                                                 | The scalable answer to variant generation — store one master, derive the rest.                                    |
| **Lazada / Shopee**     | Seller image uploads are quota-limited, virus-scanned, and moderated before going live.                                                                | Supports quotas, scanning, and moderation for seller-supplied content.                                            |

## Sequence Diagram

### Target upload pipeline

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant API as POST /files
    participant Auth as authenticate
    participant Val as Validator
    participant AV as Virus Scanner
    participant S3 as Object Storage
    participant IMG as Variant Generator
    participant DB as PostgreSQL

    C->>API: multipart/form-data
    API->>Auth: verify JWT
    Auth-->>API: userId

    API->>Val: inspect magic bytes
    alt MIME not on allow-list
        Val-->>C: 400 unsupported type
    else oversized
        Val-->>C: 413 payload too large
    end

    API->>AV: scan buffer
    alt infected
        AV-->>C: 400 rejected
    end

    API->>S3: PUT object (SSE enabled)
    S3-->>API: { url, key }

    API->>IMG: generate thumb / medium / WebP
    IMG->>S3: PUT derivatives
    IMG-->>API: variant URLs

    API->>DB: INSERT auth_files { ..., uploadedByUserId, metaData.variants }
    DB-->>API: AuthFile
    API-->>C: 201 { id, fileUrl, variants }
```

### Safe deletion with usage check

```mermaid
sequenceDiagram
    autonumber
    participant Admin
    participant API as DELETE /files/{id}
    participant DB as PostgreSQL
    participant Job as Reconciliation Job
    participant S3 as Object Storage

    Admin->>API: DELETE /files/{id}
    API->>DB: count consumers referencing fileId

    alt still referenced
        API-->>Admin: 409 + usage list — confirm to proceed
        Note over Admin: Deleting anyway is allowed:<br/>every consumer FK is SetNull,<br/>so references null out safely.
    end

    API->>DB: UPDATE auth_files SET "deletedAt" = now()
    API-->>Admin: 200 soft-deleted
    Note over DB: Row retained. Reads filter deletedAt.<br/>Storage object still exists.

    Job->>DB: SELECT soft-deleted AND unreferenced files
    DB-->>Job: candidates
    Job->>S3: DELETE objects + derivatives
    Job->>DB: hard-delete rows
```

## Entity Relationship Explanation

```mermaid
erDiagram
    AuthFile ||--o{ AuthUser : "avatar"
    AuthFile ||--o{ CatalogProductMedia : "product imagery"
    AuthFile ||--o{ SupplierProductImage : "supplier imagery"
    AuthFile ||--o{ SupplierVariantImage : "variant imagery"
    AuthFile ||--o{ CatalogCollection : "collection hero"
    AuthFile ||--o{ CatalogCollectionItem : "slot override"
    AuthFile ||--o{ CmsBanner : "banner"
    AuthFile ||--o{ MarketingSocialAd : "ad creative"
```

`AuthFile` is a **hub entity with the widest reach in the schema** — eight consumers spanning identity, catalog, supplier integration, CMS, and marketing. It holds no outbound foreign keys; everything points inward.

This shape has two important properties:

1. **It crosses every domain boundary, including the tenancy boundary.** `CatalogProductMedia` and `CmsBanner` are tenant-scoped; `AuthFile` is not. A single file row can be referenced by two different tenants simultaneously. That is intentional — it enables genuine deduplication — but it is exactly why the unscoped `GET /auth/files` endpoint constitutes cross-tenant exposure.

2. **It is the schema's storage abstraction seam.** Because consumers store a `fileId` rather than a URL, migrating from local disk to S3 to a CDN is a change to one column in one table. Had URLs been inlined into eight consumer tables, that migration would be an eight-table rewrite with no transactional safety.

## Best Practices

1. **Authenticate every upload.** No exceptions.
2. **Validate MIME by content inspection**, never by the client-supplied header.
3. **Never use the client filename as a storage path.** Generate the key server-side.
4. **Always filter `deletedAt IS NULL`** on reads.
5. **Store a `fileId`, never an inline URL**, in consumer tables.
6. **Serve binaries through a CDN** with content-hashed, long-lived URLs.
7. **Generate derivatives at upload**, not on every request.
8. **Use `SetNull` for file references** — already correct throughout.
9. **Record `altText` in `metaData`** for accessibility and SEO.
10. **Reconcile storage against the database** on a schedule.
11. **Check usage before deleting**, and surface it to the operator.

## Common Mistakes

| Mistake                                     | Consequence                                         | Correct Approach                              |
| ------------------------------------------- | --------------------------------------------------- | --------------------------------------------- |
| Leaving the upload route unauthenticated    | Anonymous storage exhaustion and malicious upload   | Add `authenticate` middleware                 |
| Returning unscoped file listings            | Cross-tenant data exposure                          | Scope by owner or restrict to admins          |
| Trusting the client's `Content-Type`        | Executables disguised as images                     | Inspect magic bytes                           |
| Using the client filename as a path         | Path traversal                                      | Server-generated storage keys                 |
| Storing raw URLs in consumer tables         | Storage migration becomes an N-table rewrite        | Reference `fileId`                            |
| Forgetting to filter `deletedAt`            | "Deleted" assets keep appearing                     | Filter on every read                          |
| Assuming soft delete removes the file       | The object stays publicly fetchable at its URL      | Delete from storage for true takedown         |
| Listing without an `ORDER BY`               | Non-deterministic results across identical requests | Explicit indexed sort key                     |
| Eager-loading a file's consumer collections | A popular asset pulls thousands of rows             | Query the consumer side                       |
| Allowing SVG uploads unsanitised            | Stored XSS via embedded JavaScript                  | Exclude or sanitise SVG                       |
| Never purging orphaned storage              | Unbounded cost growth                               | Reconciliation job                            |
| Assuming `AuthFile` is an auth model        | Misplaced security assumptions from the name        | It is shared infrastructure; treat it as such |

---

---

# Module Summary

## Purpose

Module 1 establishes the **platform identity plane** — the layer that determines who a principal is, what they may do, how long they stay authenticated, which external identities they federate to, and which binary assets the platform holds.

Its defining architectural characteristic is that it is **deliberately not tenant-scoped**. One person, one identity, every storefront. Tenancy begins at `CommerceCustomer`.

## Models at a Glance

| Model               | Role                                   | Tenant-Scoped | Delete Strategy    | Maturity                                  |
| ------------------- | -------------------------------------- | ------------- | ------------------ | ----------------------------------------- |
| `AuthUser`          | Canonical identity, credentials, role  | No            | Soft (`isDeleted`) | **Functional**, with enforcement gaps     |
| `AuthSession`       | Live refresh-token session             | No            | Hard (correct)     | **Functional and well-implemented**       |
| `AuthSocialAccount` | Federated identity + OAuth credentials | No            | Hard (correct)     | **Modelled but write-never**              |
| `AuthFile`          | Platform-wide asset registry           | No            | Soft (`deletedAt`) | **Modelled but disconnected from upload** |

## What This Module Does Well

- **The identity/commerce split** (`AuthUser` → `CommerceCustomer`) is correct and matches how Shopify and Amazon model the same problem.
- **Refresh-token rotation is properly implemented** — single-use tokens, session bound to the token's subject, cross-user replay blocked.
- **Opportunistic password rehashing at login** is a textbook-correct pattern.
- **The `publicUser` projection** deliberately prevents the password hash reaching Redis or the response body, with a comment explaining exactly why.
- **`SetNull` on every file reference** correctly distinguishes ownership from reference.
- **Hard-deleting sessions** is a principled, correct exception to the platform's soft-delete convention.

## Critical Findings

These are ordered by severity and must be addressed before production:

| #   | Finding                                              | Model               | Impact                                                             |
| --- | ---------------------------------------------------- | ------------------- | ------------------------------------------------------------------ |
| 1   | `POST /upload` has no authentication                 | `AuthFile`          | Any anonymous internet caller can upload arbitrary files.          |
| 2   | `GET /auth/files` has no `where` clause at all       | `AuthFile`          | Any authenticated user reads arbitrary files across every tenant.  |
| 3   | `isActive` is never checked at login                 | `AuthUser`          | Account suspension currently has **no effect whatsoever**.         |
| 4   | `refreshToken` stored as a plaintext, replayable JWT | `AuthSession`       | Database read compromise yields live sessions for every user.      |
| 5   | `accessToken` stored plaintext                       | `AuthSocialAccount` | Live third-party credentials, potentially with ad-spend authority. |
| 6   | `isEmailVerified` defaults to `true`                 | `AuthUser`          | Email verification is structurally defeated.                       |
| 7   | No password reset flow                               | `AuthUser`          | No account recovery path exists.                                   |
| 8   | Missing `@@unique([platform, providerUserId])`       | `AuthSocialAccount` | Account-takeover vector; also a full table scan on social login.   |
| 9   | Upload never creates an `AuthFile` row               | `AuthFile`          | The registry is unreachable — no consumer can obtain a `fileId`.   |
| 10  | No rate limiting on authentication endpoints         | `AuthUser`          | Credential stuffing is unthrottled.                                |

## Cross-Cutting Observations

**Two soft-delete conventions coexist.** `AuthUser` uses `isDeleted Boolean`; `AuthFile` uses `deletedAt DateTime?`. Elsewhere in the schema, `CatalogProduct` and `Coupon` use `deletedAt`, while `CatalogCollection` uses `isDeleted`. `deletedAt` is strictly more informative and should become the platform standard.

**Naming debt.** `AuthFile` is not an authentication model. It is shared infrastructure consumed by eight domains across catalog, CMS, marketing, and supplier integration. The prefix invites incorrect security assumptions and should eventually become `PlatformFile`.

**Three roles, one privilege level.** `ADMIN`, `SUPER_ADMIN`, and `DEVELOPER` are functionally identical at every guard. A compromised developer account carries the same blast radius as the platform owner.

**`SELLER` is a role string, not a domain model.** Marketplace semantics — seller owns tenant, seller owns product, seller receives payout — require `SellerProfile` and `SellerTenant` models that do not yet exist.

## Recommended Sequence of Work

| Phase                        | Work                                                                                            | Rationale                                                  |
| ---------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| **1 — Close the holes**      | Authenticate `/upload`; scope `/auth/files`; enforce `isActive` at login; add rate limiting     | These are exploitable today.                               |
| **2 — Harden credentials**   | Hash stored refresh tokens; encrypt provider tokens; add `@@unique([platform, providerUserId])` | Reduces blast radius of a database compromise.             |
| **3 — Complete the flows**   | Email verification; password reset; OAuth authorize/callback; persist `AuthFile` on upload      | Makes modelled features actually functional.               |
| **4 — Operational maturity** | Session cleanup job; storage reconciliation; missing indexes; audit coverage                    | Bounds unbounded growth and restores observability.        |
| **5 — Enterprise depth**     | Privilege tiering; MFA for admins; session management UI; `SellerProfile`                       | Required for genuine enterprise and marketplace operation. |

---

**End of Module 1 — Authentication & User Management**

_Awaiting confirmation to proceed to Module 2 — Multi-Tenant Store Management (`Tenant`)._
