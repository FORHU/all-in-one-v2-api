# Backend Prisma Guide

**Platform:** All-In-One V2 — Multi-Tenant Headless Commerce Platform
**Purpose:** A model-by-model explanation of the entire database schema
**Written for:** Developers, designers, QA testers, product managers, and anyone joining the team

---

## About This Guide

This guide walks through **every model in the Prisma schema**, one at a time, explaining what it is, who touches it, when records are created and changed, and how it fits into the platform end to end.

It is written to be read by someone who has never seen this codebase before. You do not need to know Prisma to follow it.

### Contents

| Part  | Module                                                                                                                                               | Status      |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| **1** | **Authentication & User Management** — `AuthUser`, `AuthSession`, `AuthSocialAccount`, `AuthFile`                                                    | ✅ Complete |
| **2** | **Multi-Tenant Store Management** — `Tenant`                                                                                                         | ✅ Complete |
| **3** | **Catalog Management** — `CatalogCategory`, `CatalogProduct`, `CatalogProductVariant`, `CatalogProductMedia`, `CatalogSizeGuide`, `CatalogSizeEntry` | ✅ Complete |
| 4     | Supplier & Dropshipping                                                                                                                              | Pending     |
| 5     | Customer Management                                                                                                                                  | Pending     |
| 6     | Shopping Cart                                                                                                                                        | Pending     |
| 7     | Orders & Fulfillment                                                                                                                                 | Pending     |
| 8     | Payments                                                                                                                                             | Pending     |
| 9     | CMS                                                                                                                                                  | Pending     |
| 10    | Marketing                                                                                                                                            | Pending     |
| 11    | Inventory                                                                                                                                            | Pending     |
| 12    | Customer Engagement                                                                                                                                  | Pending     |
| 13    | Promotions                                                                                                                                           | Pending     |
| 14    | Collections                                                                                                                                          | Pending     |
| 15    | Attributes                                                                                                                                           | Pending     |
| 16    | Pricing                                                                                                                                              | Pending     |
| 17    | Tax                                                                                                                                                  | Pending     |
| 18    | Analytics                                                                                                                                            | Pending     |
| 19    | Storefront                                                                                                                                           | Pending     |
| 20    | Operations                                                                                                                                           | Pending     |

### Related documents

| Document                                                                                             | What It Covers                                                                                                                                            |
| ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`schema/01-authentication-and-user-management.md`](schema/01-authentication-and-user-management.md) | The **architectural specification** — schema contracts, API design, indexes, security controls, sequence diagrams. Read that when designing or reviewing. |
| **This guide**                                                                                       | **Lifecycle and usage** — who touches each model, when records appear and change, what actually happens end to end. Read this first if you are new.       |

### A note on honesty

Where the schema describes something the code does not yet do, this guide says so explicitly and marks it **⚠ NOT IMPLEMENTED**. Documentation that presents intentions as behaviour is how teams ship security holes.

---

---

# Part 1 — Authentication & User Management

**Models covered:** `AuthUser`, `AuthSession`, `AuthSocialAccount`, `AuthFile`

---

## Before You Start: The One Rule That Explains Everything

The platform runs multiple storefronts — `fashion.example.com`, `beauty.example.com`, `sports.example.com`. Each is a **tenant**.

Almost every table in this schema carries a `tenantId`. **None of the four models in this document do.**

That is deliberate:

| Layer                                                                 | Tenant-scoped? | Meaning                                             |
| --------------------------------------------------------------------- | -------------- | --------------------------------------------------- |
| Identity (`AuthUser`, `AuthSession`, `AuthSocialAccount`, `AuthFile`) | **No**         | One person, one login, works on every storefront    |
| Commerce (`CommerceCustomer`, orders, carts, catalog)                 | **Yes**        | Your fashion cart and your beauty cart are separate |

So: Maria registers once and can shop on all three storefronts with the same password. But her cart, her orders, and her wishlist are separate on each. The handoff point between the two worlds is a single optional link: `AuthUser → CommerceCustomer`.

Keep this in mind and the rest of the document follows naturally.

---

---

# AuthUser

## Overview

`AuthUser` is the **account record**. One row = one person (or one staff member, or one service account) who can log in.

In simple terms: this is the row created when someone signs up. It holds their email, their username, their scrambled password, and a label saying what they are allowed to do.

It exists because the platform needs a single, trustworthy answer to "who is this?" Every other model that cares about a person — orders, reviews, notifications, audit records — points back here.

**Its role in the platform:** `AuthUser` is the root of identity. Nothing outside this module owns a user; everything else borrows a reference to one. It is also the _only_ place authorization is decided — the `role` column is what stands between a shopper and the admin dashboard.

## Purpose

**The business problem it solves:** without a unified account record, a three-storefront platform becomes three separate user databases. The same shopper would hold three passwords, support could not see their full history, and fraud patterns spanning storefronts would be invisible.

**Why it is necessary:**

1. **Proof of identity** — someone claims to be Maria; this model is how we check.
2. **Permission** — this model decides whether a request may edit a product or only view it.
3. **Accountability** — when a price changes at 2 a.m., the audit trail names a person because of this model.
4. **Continuity** — a shopper's identity survives across storefronts, devices, and years.

## Where It Is Used

| Area                     | How It Is Used                                                                                                                                                                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Authentication**       | Registration, login, token refresh, and logout all read or write this record. The `password` column is checked at login; `lastLoginAt` is stamped on success.                                                                               |
| **APIs**                 | Every authenticated endpoint resolves the caller to an `AuthUser` before doing anything. The `authenticate` middleware attaches the user to the request; `authorize(...roles)` reads `role` from it.                                        |
| **Admin Dashboard**      | Powers the user directory (`GET /users`), staff provisioning (`POST /users`), and role assignment. Admins search, filter, and inspect accounts here.                                                                                        |
| **Customer Storefront**  | Supplies the "signed in as…" header, the avatar, and the account settings page. The `onboardingCompleted` flag decides whether a first-time visitor is routed into the onboarding wizard.                                                   |
| **Checkout**             | Indirectly. Checkout works against `CommerceCustomer`, but that record only exists because an `AuthUser` created it. Guest checkout bypasses this model entirely using a session ID.                                                        |
| **Analytics**            | Registration cohorts, dormancy reports, and active-user counts are derived from `createdAt` and `lastLoginAt`. Note that **staff accounts have no `CommerceCustomer`**, which is exactly what keeps them out of customer revenue analytics. |
| **Marketing**            | Email campaigns segment on this table. `isEmailVerified` and `isActive` should gate sending — sending to suspended accounts damages sender reputation.                                                                                      |
| **CMS**                  | Only for attribution — who created or last edited a page.                                                                                                                                                                                   |
| **Inventory**            | Not directly. Inventory changes are attributed through `AuditLog`, which points back here.                                                                                                                                                  |
| **Supplier Integration** | Not directly. Supplier syncs run as background jobs with no human actor.                                                                                                                                                                    |
| **Mobile App**           | Identical to the storefront — the same token pair, the same account record.                                                                                                                                                                 |

## Who Uses It

| Actor                      | What They Do With It                                                                                                                                        |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Customer**               | Registers, logs in, views and edits their own profile, uploads an avatar, completes onboarding, logs out.                                                   |
| **Guest**                  | **Does not use it at all.** Guests are tracked by a session ID on the cart and order. A guest becomes an `AuthUser` only at registration.                   |
| **Admin**                  | Lists users, provisions staff accounts, changes roles, suspends and soft-deletes accounts, investigates support tickets.                                    |
| **Seller**                 | Uses it as an ordinary account. The `SELLER` role grants access to tenant management routes. **There is no separate seller entity** — see _Business Rules_. |
| **Warehouse Staff**        | No dedicated role exists. Warehouse operators would today be given `ADMIN`, which over-grants heavily.                                                      |
| **Marketing Team**         | Reads it for segmentation. Should not write to it.                                                                                                          |
| **Supplier**               | No access. Suppliers are external systems with API credentials, not platform accounts.                                                                      |
| **System Background Jobs** | Read it for attribution. Jobs act with no user, which is why `AuditLog.userId` is nullable.                                                                 |
| **Payment Gateway**        | No access. Gateways know about orders and payments, never accounts.                                                                                         |
| **API**                    | Resolves every authenticated request to a user; caches the public projection in Redis at `user:{id}`.                                                       |
| **Scheduler**              | Should sweep dormant accounts and expired verification tokens. **⚠ NOT IMPLEMENTED.**                                                                       |

## When Is It Created

A record is created in exactly two situations today:

1. **Self-registration** — a visitor submits email, username, password, and optional name to `POST /auth/register`. The service checks both uniqueness constraints, hashes the password, and inserts the row. The user is logged in immediately.
2. **Administrative provisioning** — an admin creates a staff account via `POST /users`, typically setting `role` at creation.

A third path is designed but not built:

3. **First social login** — signing in with Google for an email that has no account should create an `AuthUser` with `password = null`. **⚠ NOT IMPLEMENTED** — no OAuth callback route exists.

**Defaults at creation:** `role = USER`, `isActive = true`, `isDeleted = false`, `onboardingCompleted = false`, and `isEmailVerified = true`.

> **⚠ That last default is wrong and matters.** Email verification defaults to _already verified_, and nothing ever sends a verification email. The field is inert. It should default to `false` once a verification flow exists.

## When Is It Updated

| Trigger                              | What Changes                              | Who/What Does It                          |
| ------------------------------------ | ----------------------------------------- | ----------------------------------------- |
| Successful login                     | `lastLoginAt`, `updatedAt`                | `AuthSvc.login`                           |
| Login with an outdated password hash | `password` rewritten with a stronger hash | `AuthSvc.login` — see _Complete Workflow_ |
| User changes their password          | `password`                                | ⚠ NOT IMPLEMENTED — no endpoint exists    |
| User completes onboarding            | `onboardingCompleted → true`              | Storefront client                         |
| User uploads an avatar               | `avatarId`                                | Storefront client                         |
| User edits their display name        | `name`                                    | ⚠ No `PATCH /users/me` endpoint exists    |
| Admin promotes or demotes            | `role`                                    | Admin dashboard                           |
| Admin suspends an account            | `isActive → false`                        | Admin dashboard                           |
| Admin restores an account            | `isActive → true`                         | Admin dashboard                           |
| Erasure request                      | `isDeleted → true`                        | Admin dashboard                           |
| Email verified                       | `isEmailVerified → true`                  | ⚠ NOT IMPLEMENTED                         |

> **Cache warning for developers:** the public user projection is cached in Redis at `user:{id}`. Any change to `role`, `isActive`, or `isDeleted` **must** delete that key, or the old values keep being served until the cache expires. Right now only logout clears it.

## When Is It Deleted

**Soft deleted. Always.** Set `isDeleted = true`; never issue a `DELETE`.

**Why:**

A user is referenced by records that must outlive them:

- **Orders** — financial records. Deleting a user who placed a ₱40,000 order would either destroy that revenue record or leave it pointing at nothing.
- **Reviews** — other shoppers' purchase decisions depend on them.
- **Audit logs** — the security trail. An attacker who could delete their own account would erase their own tracks.
- **Notifications** — the delivery history.

Soft deletion satisfies erasure requests (the account becomes unusable and the profile can be scrubbed) while preserving the financial and forensic record that the business is legally required to keep.

> **Consistency note:** this model uses `isDeleted` (a boolean). `AuthFile`, `CatalogProduct`, and `Coupon` use `deletedAt` (a timestamp). Two conventions coexist across the schema. `deletedAt` is better — it records _when_ — and should become the standard.

## Complete Workflow

```
 1. Visitor fills in the registration form
 2. System checks email is unused, then username is unused
       └─ conflict → 400 naming the exact field
 3. Password is hashed (bcrypt) — plaintext is never stored
 4. AuthUser row created
       role=USER, isActive=true, isDeleted=false, onboardingCompleted=false
 5. Access token (short-lived) + refresh token (long-lived) issued
 6. AuthSession row created — see the AuthSession chapter
 7. Public profile cached in Redis at user:{id}
 8. Client stores both tokens; user lands on onboarding
 9. Onboarding finished → onboardingCompleted = true
10. Avatar uploaded → AuthFile created → avatarId set
11. First "add to cart" → CommerceCustomer created (identity meets commerce)
12. Checkout → CommerceOrder created, linked to the customer
13. Time passes; access token expires; refresh token silently rotates
14. Login from a new device → lastLoginAt updated, second session created
15. If the stored password hash is outdated, login transparently upgrades it
16. Support incident → admin suspends → isActive = false
17. Erasure request → isDeleted = true; orders and reviews remain intact
```

## Features

| Feature                             | Explanation                                                                                                                                                                                           |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Email + password login**          | The standard path. Password is stored only as a bcrypt hash.                                                                                                                                          |
| **Passwordless accounts**           | `password` is nullable so social-only users are representable. Login gives them a specific message rather than a confusing credential error.                                                          |
| **Platform-wide unique email**      | One address, one account, across every storefront.                                                                                                                                                    |
| **Platform-wide unique username**   | A public handle for reviews and seller pages.                                                                                                                                                         |
| **Role-based permissions**          | Five roles drive every route guard.                                                                                                                                                                   |
| **Account suspension**              | `isActive` is meant to block a user without losing their data. **⚠ Currently not enforced at login — suspension does nothing.**                                                                       |
| **Soft deletion**                   | `isDeleted` preserves orders, reviews, and audit history.                                                                                                                                             |
| **Onboarding tracking**             | `onboardingCompleted` lets the client route first-time users into a wizard.                                                                                                                           |
| **Login recency**                   | `lastLoginAt` powers dormancy reports and anomaly detection.                                                                                                                                          |
| **Automatic password-hash upgrade** | On login, an account still using the old weak hashing scheme is silently rehashed with the current one. Login is the only moment the real password is available, so it is the only chance to do this. |
| **Multiple concurrent sessions**    | Via `AuthSession` — phone and laptop signed in at once.                                                                                                                                               |
| **Multiple linked social accounts** | Via `AuthSocialAccount`. **⚠ Modelled but not wired up.**                                                                                                                                             |
| **Avatar**                          | Via `AuthFile`, reusing the platform's shared file system.                                                                                                                                            |
| **Full audit attribution**          | Every privileged action names a person.                                                                                                                                                               |
| **Notification inbox**              | Per-user, and per-tenant on the notification side.                                                                                                                                                    |

## Relationships

### Belongs To

| Relationship                                               | Why It Exists                                                                                                                                                                                                        |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A user belongs to an `AuthFile` (as avatar)** — optional | Avatars are just files. Rather than building a second upload system for profile pictures, the user borrows the platform's shared file registry and inherits CDN delivery, size tracking, and safe deletion for free. |

### Has One

| Relationship                                     | Why It Exists                                                                                                                                                                                                            |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **A user has one `CommerceCustomer`** — optional | This is the bridge from identity into commerce. It is _optional_ because admins and developers log in but never shop — giving them a customer profile would pollute every customer analytics report with staff accounts. |

### Has Many

| Relationship                             | Why It Exists                                                                                                                      |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **A user has many `AuthSession`s**       | People own more than one device. One row per session means logging out of the library computer does not log you out of your phone. |
| **A user has many `AuthSocialAccount`s** | Someone might connect Google _and_ Facebook. A rule prevents linking two Google accounts to the same user.                         |
| **A user has many `AuditLog`s**          | Every privileged action is attributed to a person.                                                                                 |
| **A user has many `Notification`s**      | The in-app inbox. Notifications _are_ tenant-scoped, so the same person receives separate streams per storefront.                  |

### Many-to-Many

None. `AuthUser` participates in no many-to-many relationship — deliberately. Identity should be a clean root, not a junction.

## Important Fields

### `email`

- **What it stores:** the account's primary email address.
- **Why it exists:** it is both the login credential and the transactional contact channel.
- **Who updates it:** the user (via a change-email flow that does not yet exist); admins during support.
- **When it changes:** rarely. It should require re-verification when it does.
- **Example value:** `maria.delacruz@example.com`
- **Business impact:** must be unique platform-wide. Two accounts sharing an address would make password reset ambiguous and order confirmations undeliverable. Should be lowercased before saving, or `Maria@x.com` and `maria@x.com` become two accounts.

### `password`

- **What it stores:** a bcrypt hash. **Never the actual password.**
- **Why it exists:** to verify a login attempt without ever knowing the real password.
- **Who updates it:** the user at registration and password change; the _system_ automatically at login when the stored hash uses an outdated scheme.
- **When it changes:** registration, password change, reset, or automatic upgrade.
- **Example value:** `$2b$12$eImiTXuWVxfM37uY4JANjQ==.LxGqLZ8xW1nOZ3pKvBqYy8dQ2rGm`
- **Business impact:** **nullable on purpose.** A social-login user has no password, and login tells them so specifically rather than failing generically. Must never appear in any API response — the code builds a separate "public user" object precisely to guarantee this.

### `username`

- **What it stores:** a unique public handle.
- **Why it exists:** a public identifier for reviews and seller pages that is not the user's email.
- **Who updates it:** the user (no endpoint yet); admins.
- **When it changes:** rarely.
- **Example value:** `maria_dlc`
- **Business impact:** unique platform-wide. Registration reports _which_ field conflicted, which is friendlier but does leak whether a username is taken.

### `role`

- **What it stores:** the account's permission level.
- **Possible values:** `USER`, `SELLER`, `ADMIN`, `SUPER_ADMIN`, `DEVELOPER`
- **Why it exists:** it is the single input to every authorization check.
- **Who updates it:** admins only. Never the user.
- **When it changes:** promotion, staff onboarding, offboarding.
- **Example value:** `USER`
- **Business impact:** **the highest-stakes field in the model.** Used by storefront, admin dashboard, and every API guard. Note: `ADMIN`, `SUPER_ADMIN`, and `DEVELOPER` currently have _identical_ permissions everywhere — a compromised developer account is as dangerous as the owner's.

### `isActive`

- **What it stores:** whether the account is administratively enabled.
- **Why it exists:** to suspend an account without deleting anything.
- **Who updates it:** admins.
- **When it changes:** fraud investigation, terms violation, reinstatement.
- **Example value:** `true`
- **Business impact:** **⚠ currently has no effect.** Login never checks it. Setting it to `false` today does not stop anyone logging in. This is a real gap, not a documentation nuance.

### `isDeleted`

- **What it stores:** whether the account has been erased.
- **Why it exists:** to honour deletion requests without destroying orders, reviews, and audit history.
- **Who updates it:** admins.
- **When it changes:** an erasure request.
- **Example value:** `false`
- **Business impact:** deleted users must be excluded from every listing and blocked from logging in. The token-refresh path already checks it.

### `isEmailVerified`

- **What it stores:** whether the email was ever confirmed.
- **Why it exists:** to distinguish a real, reachable address from a typo or a throwaway.
- **Who updates it:** should be the verification flow.
- **When it changes:** when the user clicks a verification link.
- **Example value:** `true`
- **Business impact:** **⚠ defaults to `true` and nothing ever sets it.** Every account is born "verified." Treat this field as meaningless until a verification flow ships.

### `onboardingCompleted`

- **What it stores:** whether the first-run wizard was finished.
- **Why it exists:** so the client knows whether to show onboarding.
- **Who updates it:** the storefront client.
- **When it changes:** once, at the end of onboarding.
- **Example value:** `false`
- **Business impact:** included in the cached public profile, so the client gets it on every request without an extra call. Drives first-session conversion.

### `lastLoginAt`

- **What it stores:** the time of the most recent successful login.
- **Why it exists:** dormancy reporting and "was this login unusual?" checks.
- **Who updates it:** the login flow, automatically.
- **When it changes:** every successful login.
- **Example value:** `2026-08-07T02:14:33.117Z`
- **Business impact:** feeds win-back campaigns and account-takeover detection.

### `avatarId`

- **What it stores:** a reference to the profile image file.
- **Why it exists:** to point at a shared `AuthFile` instead of storing a raw URL.
- **Who updates it:** the user.
- **When it changes:** avatar upload or removal.
- **Example value:** `3f9c1e77-2b64-4d51-9a0e-8c7f2d1b6e45`
- **Business impact:** because it is a reference, moving the platform's storage to a CDN later changes one table, not every table holding a URL.

## Admin Capabilities

| Capability                  | Available Today     | Notes                                            |
| --------------------------- | ------------------- | ------------------------------------------------ |
| **Create**                  | Yes                 | `POST /users`, admin-only.                       |
| **Search / List**           | Yes                 | `GET /users`, admin-only.                        |
| **View one user**           | Partially           | No `GET /users/{id}` endpoint yet.               |
| **Edit role**               | Needs endpoint      | Schema supports it; no `PATCH /users/{id}`.      |
| **Suspend**                 | ⚠ Ineffective       | The flag can be set but login ignores it.        |
| **Soft delete**             | Needs endpoint      | Must never hard-delete.                          |
| **Filter by role / status** | Not efficient       | No index on `role`; currently a full table scan. |
| **Export**                  | Not built           | Would need care — exports contain personal data. |
| **Bulk update**             | Not built           | Useful for bulk role assignment.                 |
| **Impersonate**             | Not built           | Valuable for support; must be heavily audited.   |
| **Force logout**            | Possible            | Delete the user's `AuthSession` rows.            |
| **View audit history**      | Yes, via `AuditLog` | Filter by `userId`.                              |

## Customer Interaction

Customers interact with this model constantly, though mostly invisibly:

- **Directly:** registering, logging in, logging out, viewing their profile (`GET /users/me`), uploading an avatar, completing onboarding.
- **Indirectly:** every authenticated page load resolves them to this record to decide what to show. The "Hi, Maria" header, the visibility of the account menu, and whether the admin link appears are all driven from here.
- **Never:** customers cannot see other users' records, change their own `role`, or see any of the internal flags (`isDeleted`, `isActive`). The API deliberately returns a trimmed "public user" object that excludes them.

**Guests** never touch this model at all. A guest shopping session is tracked by a session ID stored on the cart and order — which is why guest checkout works without an account.

## Backend Usage

| Mechanism              | How `AuthUser` Is Involved                                                                                                        |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **APIs**               | The `authenticate` middleware resolves the token to a user on every protected request. `authorize(...roles)` reads `role`.        |
| **Caching**            | The trimmed public profile is stored in Redis at `user:{id}` to avoid a database hit per request.                                 |
| **Background workers** | Read it for attribution only. Jobs have no user, which is why audit records allow a null actor.                                   |
| **Webhooks**           | Payment webhooks never touch this model — they operate on orders and payments, which reach the customer through a different path. |
| **Notifications**      | Every notification targets a `userId`.                                                                                            |
| **Reports**            | Registration cohorts, active users, dormancy.                                                                                     |
| **Scheduled jobs**     | Should exist for dormant-account sweeps and verification-token cleanup. ⚠ None exist.                                             |

## Business Rules

| #   | Rule                                                               | Enforced?                                    |
| --- | ------------------------------------------------------------------ | -------------------------------------------- |
| 1   | Email must be unique across the entire platform                    | ✅ Database constraint                       |
| 2   | Username must be unique across the entire platform                 | ✅ Database constraint                       |
| 3   | Passwords are stored only as hashes, never plaintext               | ✅                                           |
| 4   | A user with no password must not be able to log in with a password | ✅ Explicit message                          |
| 5   | Wrong password and unknown email must look identical to the caller | ✅ Both return the same generic error        |
| 6   | Soft-deleted users must not be able to refresh their session       | ✅                                           |
| 7   | Suspended users must not be able to log in                         | ❌ **Not enforced**                          |
| 8   | Users must never be hard-deleted                                   | ✅ By convention — no delete endpoint exists |
| 9   | A user cannot change their own role                                | ✅ No self-service role endpoint             |
| 10  | The password hash must never leave the server                      | ✅ Enforced by the public-user projection    |
| 11  | Repeated failed logins must be throttled                           | ❌ **Not enforced**                          |
| 12  | Email should be lowercased before saving                           | ❌ Not enforced                              |
| 13  | `AuthUser` must never carry a `tenantId`                           | ✅ By design                                 |

## Example Scenario

**Maria shops across two storefronts.**

Maria discovers `fashion.example.com` through an Instagram ad. She browses as a guest and adds a linen dress to her cart — no account involved, just a session ID.

At checkout she is asked to register. She enters her email and picks the username `maria`. The system rejects it: taken. She tries `maria_dlc` and it works. An `AuthUser` row is created with `role = USER` and `onboardingCompleted = false`. She is logged in instantly — no verification email interrupts her purchase, because `isEmailVerified` defaults to `true`.

Her guest cart is attached to a newly created `CommerceCustomer`, and she completes her order.

She finishes the style-preference wizard; `onboardingCompleted` flips to `true`. She uploads a profile photo — an `AuthFile` row is created and `avatarId` points at it.

Three weeks later she visits `beauty.example.com`. **Her login works immediately.** Same `AuthUser`, same password. But her cart is empty and her order history looks blank on this storefront — because carts and orders are tenant-scoped while her identity is not.

Six months on, support flags her account after a suspicious login from another country. An admin sets `isActive = false`. **Nothing happens** — Maria can still log in, because the login flow never checks that flag. The admin has to delete her `AuthSession` rows to force her out, and even then she can simply log in again. _This is the gap described in Business Rule #7._

## Summary

`AuthUser` is the foundation the entire platform stands on. It answers who someone is, what they may do, and whether they are still welcome. It is deliberately kept free of tenant scoping so one person can shop across every storefront with one login, and it hands off to `CommerceCustomer` at the exact point where identity becomes commerce.

The model is well shaped. Its weaknesses are in enforcement rather than design: suspension does not suspend, email verification does not verify, and there is no throttling on login. All three are fixable without schema changes.

---

---

# AuthSession

## Overview

`AuthSession` is a record of **one active login on one device**. Sign in on your phone, get a row. Sign in on your laptop, get a second row. Sign out on the laptop, that row is deleted; the phone row survives.

In plainer terms: it is the list of "places you are currently signed in."

It exists to solve a specific technical problem. The platform uses JWTs — self-contained signed tokens. A JWT cannot be cancelled; once issued, it stays valid until it expires. For a platform holding addresses and payment history, "we cannot sign this person out" is unacceptable. `AuthSession` fixes that by making the long-lived half of the login checkable against the database.

**Its role in the platform:** it is what makes logout, "sign out everywhere," and forced sign-out during a security incident actually possible.

## Purpose

**The business problem it solves:** revocation. Without it, a stolen login is permanent until natural expiry.

**Why it is necessary:**

1. **Logout must mean something.** Deleting the row ends the ability to stay signed in.
2. **Multiple devices are normal.** One row each means per-device control.
3. **Security incidents demand a kill switch.** Deleting every row for a user forces re-authentication everywhere.
4. **Stolen tokens must have a short life.** Each use of a refresh token replaces it, so an old copy stops working.

## Where It Is Used

| Area                                                  | How It Is Used                                                                                                                                            |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Authentication**                                    | Created at login and registration. Checked and replaced on every token refresh. Deleted at logout.                                                        |
| **APIs**                                              | Only on the refresh endpoint. Regular API calls check the short-lived access token and never touch this table — which is what keeps the common path fast. |
| **Mobile App**                                        | Heavily. Mobile apps stay installed for months, so they refresh far more often than a browser does.                                                       |
| **Customer Storefront**                               | Keeps the shopper signed in between visits without re-entering a password.                                                                                |
| **Admin Dashboard**                                   | Should offer session inspection and forced sign-out during incident response. ⚠ No endpoints exist yet.                                                   |
| **Analytics**                                         | Concurrent session counts are a useful signal for credential sharing. Not currently reported on.                                                          |
| **Checkout / CMS / Inventory / Marketing / Supplier** | Not used. These operate on the access token, never on the session record.                                                                                 |

## Who Uses It

| Actor                                                             | What They Do With It                                                                                                |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Customer**                                                      | Creates one by logging in; consumes and replaces it by staying signed in; deletes it by logging out. Never sees it. |
| **Guest**                                                         | Never. Guests are not authenticated.                                                                                |
| **Admin**                                                         | Should be able to view and revoke a user's sessions during support. ⚠ Endpoints not built.                          |
| **Seller**                                                        | Same as any user.                                                                                                   |
| **System Background Jobs**                                        | Should purge expired rows on a schedule. ⚠ No such job exists — the table grows forever.                            |
| **API**                                                           | Validates the session on every refresh; deletes and recreates it as part of rotation.                               |
| **Scheduler**                                                     | Should run the cleanup sweep. ⚠ Not implemented.                                                                    |
| **Payment Gateway / Supplier / Marketing Team / Warehouse Staff** | No interaction.                                                                                                     |

## When Is It Created

Three moments, all of them a successful authentication:

1. **Registration** — the new account is signed in immediately, so a session is created straight away.
2. **Login** — email and password verified.
3. **Token refresh** — a _new_ session replaces the one just consumed. This is the most frequent creation path by far.

Every new row is stamped with an expiry seven days out and records which provider established it (`local`, or the social platform's name).

## When Is It Updated

**Never.** `AuthSession` rows are immutable.

This surprises people, so it is worth stating plainly: refreshing a token does **not** update the row. It **deletes** the old row and **inserts** a new one. There is no `UPDATE` path anywhere in the code for this table.

That design choice is what guarantees a refresh token can only be used once — the old row is gone, so presenting the old token again finds nothing.

## When Is It Deleted

**Permanently deleted — hard delete. Never soft deleted.** This is a deliberate exception to the platform's usual soft-delete convention.

**Why hard delete is correct here:**

A soft-deleted session would still be a working credential unless every single query remembered to filter it out. One forgotten filter and a "revoked" session silently keeps working. Revocation has to be absolute, and the only unambiguous way to say "this credential is dead" is for the row not to exist.

**Deletion happens when:**

| Trigger               | Scope                                           |
| --------------------- | ----------------------------------------------- |
| Token refresh         | The consumed session only                       |
| Logout                | The session matching the presented token        |
| Admin forced sign-out | All sessions for that user                      |
| Password change       | Should delete all sessions ⚠ no endpoint exists |
| Scheduled cleanup     | All expired sessions ⚠ not implemented          |

Expired sessions also stop working _before_ deletion — the lookup requires the expiry to be in the future, so an expired row simply never matches. Cleanup is therefore about disk space, not security.

## Complete Workflow

```
 1. User submits correct credentials
 2. Access token signed  (short life, not stored anywhere)
 3. Refresh token signed (long life, contains a random unique ID)
 4. AuthSession row created — expiry set 7 days out, provider recorded
 5. Both tokens returned to the client
 6. Client uses the access token for normal API calls
       └─ the session table is NOT touched during normal browsing
 7. Access token expires; an API call returns 401
 8. Client sends the refresh token
 9. Signature checked
10. Session looked up — must exist AND not be expired
11. Session's user must match the user named in the token
12. User must not be soft-deleted
13. OLD SESSION ROW DELETED       ← the old refresh token is now dead
14. New token pair issued; new session row created
15. Client MUST save the new refresh token
16. ... steps 6–15 repeat for as long as the user stays active ...
17. User logs out → that one row deleted → other devices unaffected
18. Or: 7 days of inactivity → expiry passes → session stops matching
```

## Features

| Feature                          | Explanation                                                                                                         |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **One row per device**           | Enables per-device logout instead of an all-or-nothing sign-out.                                                    |
| **Single-use refresh tokens**    | Each refresh deletes the old row, so a copied token stops working after the real user next refreshes.               |
| **Absolute expiry**              | Seven days, checked as part of the lookup, so expired sessions fail closed automatically.                           |
| **Cross-user replay protection** | The session's owner must match the user named in the token — a token cannot be used against someone else's session. |
| **Deleted-user check**           | A soft-deleted user cannot refresh, even holding a valid token.                                                     |
| **Provider tracking**            | Records whether the login was local or social, and carries that forward through every refresh.                      |
| **Provider avatar**              | Stores the profile picture URL from the social provider so a social user has an avatar with no upload.              |
| **Instant bulk revocation**      | Delete every row for a user and they are signed out everywhere.                                                     |

## Relationships

### Belongs To

| Relationship                            | Why It Exists                                                                                                                                  |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **A session belongs to one `AuthUser`** | A session is meaningless without an owner. This link is what makes "show me all of Maria's sessions" and "sign Maria out everywhere" possible. |

### Has Many / Has One / Many-to-Many

**None.** `AuthSession` references `AuthUser` and nothing else, and nothing references `AuthSession`.

This isolation is genuinely useful: because no other table depends on sessions, they can be deleted in bulk at any time with zero risk of breaking something else. It is the only table in the whole schema you could safely empty completely — the worst outcome is that everyone has to log in again.

## Important Fields

### `refreshToken`

- **What it stores:** the complete long-lived token that was issued to the client.
- **Why it exists:** it is what the client presents to stay signed in, and what the server looks up to confirm the session is real.
- **Who updates it:** never updated. Written once at creation.
- **When it changes:** never — the row is replaced instead.
- **Example value:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJiN2Ez...`
- **Business impact:** unique across the whole table. **⚠ Stored in plain text.** Anyone who can read this table — through a backup, a replica, or a leaked query log — holds working credentials for every signed-in user. Storing a scrambled version instead would fix this without changing how anything works.

### `expiresAt`

- **What it stores:** the moment the session stops being valid.
- **Why it exists:** to guarantee sessions do not live forever.
- **Who updates it:** set once at creation; never changed.
- **When it changes:** never.
- **Example value:** `2026-08-14T02:14:33.117Z`
- **Business impact:** part of the lookup condition, so expired sessions fail closed automatically. **⚠ A subtle bug lurks here:** this is hardcoded to seven days, while the token's _own_ internal expiry comes from a configuration setting. Change the config to thirty days and sessions will still die at seven, with no obvious explanation.

### `userId`

- **What it stores:** which account owns this session.
- **Why it exists:** links the session to a person.
- **Who updates it:** never changed.
- **When it changes:** never.
- **Example value:** `b7a3f1c2-9d4e-4a8b-b1f0-6c2e5d9a3f74`
- **Business impact:** indexed, so "all sessions for this user" is fast — which is what makes bulk sign-out practical.

### `provider`

- **What it stores:** how this login was established — `local` or a social platform name.
- **Why it exists:** to distinguish password logins from social logins.
- **Who updates it:** set at creation and carried forward on every refresh.
- **When it changes:** never within a session's life.
- **Example value:** `local`
- **Business impact:** deliberately a plain text label rather than a link to `AuthSocialAccount`. If it were a real link, unlinking your Google account would forcibly sign you out everywhere — which is not what anyone wants.

### `createdAt`

- **What it stores:** when this session began.
- **Why it exists:** to show "signed in since…" and to spot unusual login timing.
- **Who updates it:** set automatically.
- **When it changes:** never.
- **Example value:** `2026-08-07T02:14:33.117Z`
- **Business impact:** note that because refresh _replaces_ the row, this resets on every refresh. It reflects the age of the current token, not of the original login.

## Admin Capabilities

| Capability                                      | Available Today                                     |
| ----------------------------------------------- | --------------------------------------------------- |
| **Force sign-out of one user**                  | Possible directly against the database; no endpoint |
| **View a user's active sessions**               | Not built                                           |
| **See how many devices a user is signed in on** | Not built                                           |
| **Revoke one specific session**                 | Not built                                           |
| **See whether a login was social or password**  | Data exists; not surfaced                           |
| **Purge expired sessions**                      | Not built                                           |

This is the least developed area of the module. Everything needed is in the data; only the endpoints are missing.

## Customer Interaction

Customers interact with this model **constantly but entirely invisibly.**

Every time a shopper returns to the site and finds themselves still signed in, this model is why. Every silent background token renewal is a row being deleted and recreated. The user never sees, names, or thinks about a session.

The one place it becomes visible is logout — and specifically, the fact that logging out on a shared computer does _not_ sign them out on their phone. That behaviour is a direct consequence of one-row-per-session, and it matches what users expect.

**What is missing:** most mature platforms show users a "your active sessions" screen listing devices and locations with a revoke button. That is not built here, and building it would need extra fields (device, IP, last used) that the model does not currently have.

## Backend Usage

| Mechanism                              | How It Is Involved                                                                                                                                                       |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **APIs**                               | Only the refresh endpoint reads or writes it. Deliberately kept off the hot path.                                                                                        |
| **Background workers**                 | Should purge expired rows. ⚠ Not implemented — the table grows without limit.                                                                                            |
| **Scheduled jobs**                     | Same. A nightly cleanup would be a few lines; the scheduling library is already installed.                                                                               |
| **Webhooks / Notifications / Reports** | No involvement.                                                                                                                                                          |
| **Caching**                            | **Deliberately never cached.** The whole point is that deleting a row takes effect immediately; caching would reintroduce the exact delay the model exists to eliminate. |

## Business Rules

| #   | Rule                                                       | Enforced?                                       |
| --- | ---------------------------------------------------------- | ----------------------------------------------- |
| 1   | A refresh token can be used exactly once                   | ✅ Old row deleted before the new one is issued |
| 2   | The session's owner must match the user named in the token | ✅ Blocks using someone else's token            |
| 3   | Expired sessions must not work                             | ✅ Part of the lookup                           |
| 4   | Soft-deleted users cannot refresh                          | ✅                                              |
| 5   | Suspended users cannot refresh                             | ❌ Not enforced                                 |
| 6   | Logout must delete only the current session                | ✅                                              |
| 7   | Sessions are hard-deleted, never soft-deleted              | ✅                                              |
| 8   | Refresh tokens must never appear in a response or a log    | ✅ Currently true; must stay true               |
| 9   | The row's expiry must agree with the token's own expiry    | ❌ Two independent sources — can drift          |
| 10  | Reusing an already-consumed token should raise an alarm    | ❌ Treated as an ordinary failure               |
| 11  | Changing a password should delete all sessions             | ❌ No password-change flow exists               |

**Rule 10 deserves attention.** Today, replaying a stolen token that has already been used just returns a generic failure — indistinguishable from a token that expired naturally. Mature platforms treat that as proof of theft and sign the user out everywhere. The information is right there; nothing acts on it.

## Example Scenario

**Maria, two devices, one incident.**

Maria signs in on her phone on Monday. Session A is created, valid until the following Monday.

On Wednesday she signs in at a public library computer. Session B is created. Two rows now exist, completely independent.

While browsing on her phone that afternoon, her access token quietly expires. The app sends the refresh token; session A is deleted and session A′ is created. **Maria notices absolutely nothing** — this is the model working correctly.

She leaves the library and clicks "Log out." Session B is deleted. Her phone stays signed in, which is exactly what she expects.

The following week she reports a suspicious charge. Support deletes every session row for her account. Her phone's next refresh fails and she is prompted to log in again.

**One important caveat:** the _access_ token her phone is currently holding keeps working until it expires. If that token has ten minutes left, there is a ten-minute window where the attacker's stolen access token also still works. This is why keeping access tokens short-lived matters — it is the true measure of how fast the platform can actually cut someone off.

## Summary

`AuthSession` is small — seven columns, one relationship — but it carries the entire weight of the platform's ability to say "you are signed out."

It is the best-implemented model in this module. Rotation is done properly, cross-user replay is blocked, expiry fails closed, and hard deletion is the right call for a credential.

Its two real weaknesses are that the token is stored in readable form, and that nothing ever cleans up expired rows. Neither affects correctness today; both matter at scale and under compromise.

---

---

# AuthSocialAccount

## Overview

`AuthSocialAccount` records the connection between a platform account and an outside identity provider — Google, Facebook, TikTok, Apple.

One row says: _"this user is also this person on Google, and here is the permission slip Google gave us."_

It does two quite different jobs, and it helps to keep them apart:

1. **Signing in** — "Continue with Google" instead of a password.
2. **Acting on the user's behalf** — holding a permission token so the platform can, for example, push a product catalog into a seller's Meta Business account.

The second job is the more important one for this platform, because the Marketing module depends on it entirely.

> **⚠ Status: this model is currently empty and always will be until someone builds the OAuth flow.** There is an endpoint to _read_ linked accounts, but nothing anywhere in the codebase _creates_ one. There is no "Continue with Google" route. Everything below describes how it is designed to work, not how it currently works.

## Purpose

**The business problem it solves:** two of them.

For shoppers: passwords are friction, and friction at checkout costs sales. Social login removes a step and supplies a verified email and a profile photo for free.

For sellers: the platform cannot publish a product feed to Meta or create ads on Google without the seller's permission. That permission arrives as an OAuth token, and this is where it lives.

**Why it is necessary:** without it, `MarketingSocialFeed` and `MarketingSocialAd` have no credentials to work with. They can be configured but they cannot actually publish anything.

## Where It Is Used

| Area                                                  | How It Is Used                                                                                                                                           |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Authentication**                                    | Signing in with a social provider. Also allows accounts with no password at all.                                                                         |
| **Marketing**                                         | **The critical dependency.** Publishing catalog feeds to Meta and creating ads on Google both require the token stored here, with the right permissions. |
| **Admin Dashboard**                                   | Support staff check which providers a user has connected — a user reporting "my password does not work" is very often a social-only user.                |
| **Customer Storefront**                               | The "Continue with Google" button, and the account-settings page listing connected accounts.                                                             |
| **Seller tools**                                      | Where a seller connects their Meta Business or Google Merchant account.                                                                                  |
| **APIs**                                              | One read endpoint exists. The authorize and callback endpoints do not.                                                                                   |
| **Mobile App**                                        | Native social sign-in, which uses the same underlying flow.                                                                                              |
| **Checkout / CMS / Inventory / Analytics / Supplier** | No involvement.                                                                                                                                          |

## Who Uses It

| Actor                                            | What They Do With It                                                                                                       |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| **Customer**                                     | Signs in with Google; views connected accounts; should be able to disconnect one.                                          |
| **Guest**                                        | Uses it at the moment of first social sign-in, which converts them into a customer.                                        |
| **Seller**                                       | **The most important user.** Connects a business account so the platform can publish products and run ads on their behalf. |
| **Admin**                                        | Reads it during support to diagnose login problems and failed marketing syncs.                                             |
| **Marketing Team**                               | Depends on it indirectly — their campaigns fail when a token here expires.                                                 |
| **System Background Jobs**                       | Should refresh expiring tokens before they lapse. ⚠ No such job exists.                                                    |
| **Scheduler**                                    | Should trigger that refresh job. ⚠ Not implemented.                                                                        |
| **API**                                          | Would run the OAuth exchange. ⚠ Not implemented.                                                                           |
| **Supplier / Payment Gateway / Warehouse Staff** | No involvement.                                                                                                            |

## When Is It Created

**Today: never.** No code path creates one.

**As designed**, a record would be created when:

1. A user clicks "Continue with Google" for the first time and approves access.
2. An already-signed-in user connects an additional provider from account settings.
3. A seller connects a business account to enable catalog and ad publishing.

The dangerous moment in all three is what happens when the provider's email already belongs to an existing account. Getting that wrong is how platforms get taken over. See _Business Rules_.

## When Is It Updated

| Trigger                                            | What Changes                                           |
| -------------------------------------------------- | ------------------------------------------------------ |
| User signs in with the provider again              | Permission token and expiry refreshed                  |
| Background token refresh                           | Token and expiry updated before they lapse ⚠ not built |
| User re-approves with additional permissions       | Permission list updated                                |
| User changes their profile picture at the provider | Avatar URL may be refreshed                            |

The permission token is the field that changes most. Providers issue tokens with their own lifetimes — Meta's typically last about sixty days — and something has to renew them before they expire, or marketing jobs start failing in ways that look like an outage rather than an expired login.

## When Is It Deleted

**Permanently deleted — hard delete.** Same reasoning as sessions: a "soft deleted" connection that still holds a live permission token is a credential that looks revoked but is not.

**Deleted when:**

- The user disconnects the provider.
- An admin force-disconnects a compromised connection.
- The account is closed.

**Critical rule:** disconnecting must be **blocked** if it would remove the user's only way to log in. Someone who signed up with Google and never set a password would be permanently locked out of their own account, with no recovery path. ⚠ This guard does not exist because the disconnect endpoint does not exist.

Proper disconnection should also tell the provider the permission is no longer needed — otherwise the platform keeps a valid token it no longer has any right to.

## Complete Workflow

```
 1. User clicks "Continue with Google"
 2. Platform generates a one-time value to prove the reply is genuine
 3. User is redirected to Google
 4. Google asks the user to approve the requested permissions
 5. User approves
 6. Google redirects back with a temporary code
 7. Platform verifies the one-time value       ← blocks a forged reply
 8. Platform swaps the code for a permission token (server-side only)
 9. Platform asks Google who this is → stable ID, email, photo, and
    whether Google has confirmed the email
10. Decision point:
      a) Already connected      → refresh the stored token, sign in
      b) Not connected, but the email matches an existing account
             → Google confirmed the email? → connect them
             → not confirmed?              → REFUSE (takeover risk)
      c) Nobody with that email → create a new account with no password,
                                  then connect it
11. A login session is created, tagged with the provider
12. User is signed in
13. ... later ...
14. Token nears expiry → background job renews it   ⚠ not built
15. Marketing job uses the token to publish a product feed
16. User disconnects → row deleted (only if another login method remains)
```

## Features

| Feature                         | Explanation                                                                                               |
| ------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **Sign in without a password**  | Removes friction at the highest-value moment — checkout.                                                  |
| **Connect several providers**   | Google and Facebook on one account.                                                                       |
| **One connection per provider** | A rule prevents linking two Google accounts to the same user.                                             |
| **Accounts with no password**   | Works together with the nullable password on `AuthUser`.                                                  |
| **Permission-token storage**    | The whole basis of the marketing integrations.                                                            |
| **Renewal token storage**       | For providers that support unattended renewal. Optional, because not all do.                              |
| **Expiry tracking**             | Lets the platform renew before failing rather than after.                                                 |
| **Permission list**             | Lets the platform check up front whether it has the rights it needs, rather than discovering it mid-call. |
| **Provider avatar**             | A profile picture with no upload.                                                                         |

## Relationships

### Belongs To

| Relationship                                   | Why It Exists                                                                                                                               |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **A social account belongs to one `AuthUser`** | The connection has to attach to somebody. This link is also what lets the system count a user's login methods before allowing a disconnect. |

### Has Many / Has One / Many-to-Many

**None declared.**

But there is an important _undeclared_ dependency worth knowing about: `MarketingSocialFeed` and `MarketingSocialAd` cannot function without the token stored here, yet no database link expresses that. The connection is made in code at the moment a job runs.

This was a deliberate choice — a marketing campaign should survive a temporary login problem rather than being deleted along with it. But it has a real cost: **the dependency is invisible on any diagram.** Someone working on the Marketing module could easily not realise this table exists. It is called out here for that reason.

## Important Fields

### `platform`

- **What it stores:** which provider this is.
- **Why it exists:** the same user can connect several, so each row must say which one.
- **Who updates it:** set at connection; never changed.
- **When it changes:** never.
- **Example value:** `google`
- **Business impact:** free-form text rather than a fixed list, so `Google` and `google` would be treated as different providers and could produce a duplicate connection. Should be forced to lowercase, ideally restricted to a fixed set.

### `providerUserId`

- **What it stores:** the user's permanent ID at the provider.
- **Why it exists:** it is the real key linking the two systems.
- **Who updates it:** set at connection; never changed.
- **When it changes:** never — that is the point.
- **Example value:** `112893746650192834710`
- **Business impact:** **this, not email, is the correct thing to match on.** People change their email address; their provider ID never changes. ⚠ There is currently no rule stopping the _same_ Google identity being connected to two different platform accounts, which is a genuine takeover route. It is also the field the sign-in flow would search on, and with no index that search would scan the entire table.

### `accessToken`

- **What it stores:** the permission slip letting the platform act at the provider.
- **Why it exists:** publishing a catalog or creating an ad requires it.
- **Who updates it:** the connection flow, and the renewal job.
- **When it changes:** at every sign-in and every renewal.
- **Example value:** `ya29.a0AfH6SMBx7...`
- **Business impact:** **the highest-risk field in this document.** This is not a platform password — it is a live key to someone else's account, potentially one with the right to spend an advertising budget. It is stored in readable form. Anyone reading this table could spend a seller's money. It must be scrambled before production.

### `refreshToken`

- **What it stores:** a longer-lived key used to obtain a fresh permission slip.
- **Why it exists:** so tokens can be renewed without asking the user again.
- **Who updates it:** the connection flow.
- **When it changes:** rarely.
- **Example value:** `1//0eXk9_Lm2Qp...` or empty
- **Business impact:** optional, because not every provider issues one. Meta, for example, issues long-lived tokens that are swapped rather than refreshed. Code must handle it being absent.

### `expiresAt`

- **What it stores:** when the permission slip stops working.
- **Why it exists:** so renewal can happen _before_ something breaks.
- **Who updates it:** the connection and renewal flows.
- **When it changes:** at every renewal.
- **Example value:** `2026-10-06T08:02:19.000Z`
- **Business impact:** completely separate from how long the user stays signed in to the platform. A user can be perfectly signed in while their Google permission has lapsed. Marketing jobs must check this first, or failures look like provider outages.

### `scopes`

- **What it stores:** the list of permissions the user actually granted.
- **Why it exists:** so the platform can tell in advance whether it is allowed to do something.
- **Who updates it:** the connection flow.
- **When it changes:** when the user re-approves with different permissions.
- **Example value:** `email public_profile catalog_management ads_management`
- **Business impact:** the difference between a shopper's connection and a seller's. A shopper grants basic profile access; a seller must grant catalog and ad permissions. Checking this first turns a confusing API error into a clear "please reconnect with business permissions."

### `avatarUrl`

- **What it stores:** the user's profile picture at the provider.
- **Why it exists:** an avatar with no upload.
- **Who updates it:** the connection flow.
- **When it changes:** on re-connection.
- **Example value:** `https://lh3.googleusercontent.com/a/ACg8ocK...`
- **Business impact:** minor. Goes stale if the user changes their photo at the provider.

## Admin Capabilities

| Capability                                               | Available Today                            |
| -------------------------------------------------------- | ------------------------------------------ |
| **See a user's connected providers**                     | Only for the logged-in user; no admin view |
| **Diagnose an expired marketing connection**             | Data exists; no interface                  |
| **Check whether a seller granted the right permissions** | Data exists; no interface                  |
| **Force-disconnect a compromised connection**            | Not built                                  |
| **Trigger a token renewal**                              | Not built                                  |
| **See which users signed up via social**                 | Not built                                  |

## Customer Interaction

**Designed to be the smoothest interaction on the platform, and currently non-existent.**

As intended: a shopper taps "Continue with Google," approves once, and is signed in with a profile photo already in place. No password to invent, no password to forget.

The one place it becomes visibly confusing is when a social user later tries to sign in with a password out of habit. The platform gives them a specific message — "this account uses social login" — rather than a generic failure. That is a deliberate trade-off: it reveals slightly more than a generic error, but it is genuinely actionable and prevents a support ticket.

**Right now:** none of this works. There is no social sign-in button that could function, because there is no endpoint behind it.

## Backend Usage

| Mechanism              | How It Is Involved                                                                                                                      |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **APIs**               | One read endpoint, correctly filtered to the logged-in user. The connection endpoints do not exist.                                     |
| **Background workers** | Marketing jobs read the token here before calling Meta or Google.                                                                       |
| **Scheduled jobs**     | Should renew tokens before expiry. ⚠ Not built — this is why marketing integrations would silently stop working after about sixty days. |
| **Webhooks**           | Providers can notify when a user revokes access. Not handled.                                                                           |
| **Notifications**      | Should alert a seller when their connection needs renewing. Not built.                                                                  |
| **Reports**            | Which providers users prefer. Not built.                                                                                                |

## Business Rules

| #   | Rule                                                            | Enforced?                                          |
| --- | --------------------------------------------------------------- | -------------------------------------------------- |
| 1   | One connection per provider per user                            | ✅ Database rule                                   |
| 2   | **One provider identity must map to only one platform account** | ❌ **Missing — this is an account-takeover route** |
| 3   | Never auto-connect based on an unverified email                 | ❌ Flow not built; must be built correctly         |
| 4   | The reply from the provider must be proven genuine              | ❌ Flow not built                                  |
| 5   | Disconnecting must not remove the last login method             | ❌ Not built                                       |
| 6   | Permission tokens must never be sent to the browser             | ✅ Must stay true                                  |
| 7   | Permission tokens must be scrambled before storage              | ❌ Stored readable                                 |
| 8   | Provider names must be lowercase                                | ❌ Not enforced                                    |
| 9   | Check expiry before calling the provider                        | ❌ Not implemented                                 |
| 10  | Check permissions before calling the provider                   | ❌ Not implemented                                 |
| 11  | Disconnecting is permanent, not soft                            | ✅ By design                                       |

**Rules 2 and 3 are the ones to worry about.**

Rule 2: nothing stops the same Google identity being connected to two different accounts. An attacker could connect a victim's Google identity to their own account and then sign in "as themselves" using it.

Rule 3: if the platform automatically connects a Google login to any existing account with a matching email, an attacker who creates a Google account using the victim's email address takes over the victim's account. The only safe options are to require the provider to confirm the email, or to require the user to sign in with their existing password first.

## Example Scenario

**A seller's ads stop running.**

Danilo runs a sportswear storefront. In June he connects his Meta Business account so the platform can publish his catalog and run ads. A row is created with permissions including catalog and ad management, and a token valid for sixty days.

Everything works. His catalog syncs nightly; ads run; sales come in.

In late August the nightly sync starts failing. The error looks like a Meta API problem, so nobody investigates urgently. Ads stop being updated. Two weeks pass. His seasonal campaign quietly stops.

The actual cause: the token expired in mid-August. **Nothing renewed it, because no renewal job exists.** The information needed to prevent this was sitting in the expiry field the whole time.

**What should have happened:** a nightly job notices the token expires in seven days, renews it automatically, and only alerts Danilo if renewal fails.

**A second, sharper scenario.** Suppose a shopper signs up with a password using `victim@example.com`. An attacker creates a Google account with that same address — some providers allow this without confirming ownership. The attacker clicks "Continue with Google." If the platform connects automatically on matching email, the attacker now owns the victim's account, including their saved addresses and order history. This is exactly what Rules 2 and 3 exist to prevent.

## Summary

`AuthSocialAccount` is the most _potentially_ valuable model in this module and currently the least real. It would remove password friction for shoppers and it is the only thing standing between the Marketing module and actually being able to publish anything.

It is also the model with the most dangerous failure modes. Account connection is where takeover attacks happen, and the two rules that prevent them are both unimplemented. The tokens it is designed to hold are live keys to other people's business accounts.

The right sequence is: build the connection flow carefully with the safety rules in place, scramble the tokens, add the renewal job — then turn it on. Building it quickly and correcting it later is not a safe option for this particular model.

---

---

# AuthFile

## Overview

`AuthFile` is the **platform's file registry**. Every uploaded image, video, or document gets one row recording where it lives, what type it is, and how big it is.

Despite the name, **this has nothing to do with authentication.** The `Auth` prefix is a leftover from the starter template this project grew out of. It is genuinely shared infrastructure, used by eight different parts of the platform: product photos, user avatars, storefront banners, ad creatives, collection images, and supplier imagery.

Think of it as the platform's media library. Upload something once, use it in many places.

**Its role in the platform:** it is the single place that knows where files actually live. Everything else stores a reference to a row here rather than a web address, which means moving to a different storage provider later changes one table instead of eight.

## Purpose

**The business problem it solves:** without it, image addresses would be copied into a dozen tables. Moving to a CDN would mean rewriting all of them. Deleting an image would leave broken pictures scattered across the site with no way to find them.

**Why it is necessary:**

1. **Use once, reference many times.** One photo can be a product image, a collection banner, and an ad creative — one upload, one stored file.
2. **Safe removal.** Removing a file clears references rather than breaking the products that used it.
3. **Governance.** Recording type and size makes it possible to answer "how much are we storing and what is it?"
4. **Freedom to move.** Consumers hold a reference, not an address.

## Where It Is Used

| Area                                 | How It Is Used                                                                                                      |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| **Catalog**                          | Product and variant photography — the highest-volume use by far.                                                    |
| **Customer Storefront**              | Every image a shopper sees traces back to a row here.                                                               |
| **CMS**                              | Banner images on storefront pages.                                                                                  |
| **Marketing**                        | Ad creatives, including video.                                                                                      |
| **Collections**                      | Hero images for curated sets, and per-item override images.                                                         |
| **Supplier Integration**             | Supplier photos copied into the platform's own storage, so listings do not break when a supplier's website changes. |
| **Authentication**                   | User avatars — the smallest use, despite the model's name.                                                          |
| **Admin Dashboard**                  | The media library where staff upload and manage assets.                                                             |
| **Mobile App**                       | Consumes the same images.                                                                                           |
| **Inventory / Checkout / Analytics** | No direct involvement.                                                                                              |

## Who Uses It

| Actor                                 | What They Do With It                                                                          |
| ------------------------------------- | --------------------------------------------------------------------------------------------- |
| **Customer**                          | Views images constantly; uploads an avatar. Never sees the registry itself.                   |
| **Guest**                             | Views images.                                                                                 |
| **Admin**                             | Uploads product photography, banners, and campaign images; manages the library.               |
| **Seller**                            | Uploads product images and ad creatives.                                                      |
| **Marketing Team**                    | Uploads campaign creatives, including video.                                                  |
| **Supplier**                          | Not directly — but supplier images are copied in by sync jobs.                                |
| **System Background Jobs**            | Supplier syncs create image records. A cleanup job _should_ remove unused files. ⚠ Not built. |
| **API**                               | Serves file references to every client.                                                       |
| **Scheduler**                         | Should run storage cleanup. ⚠ Not built.                                                      |
| **Warehouse Staff / Payment Gateway** | No involvement.                                                                               |

## When Is It Created

**In theory:** whenever anyone uploads a file — an admin adding product photos, a customer setting an avatar, a supplier sync copying images.

**In practice: ⚠ never.**

This is the single most important thing to know about this model. The upload endpoint accepts a file, writes it to disk, logs it, and replies with the file's name and size. **It never creates a database row.** No web address is returned either.

The result is that the upload endpoint and the file registry are completely disconnected. There is no supported way to obtain a file reference, which means nothing can attach one.

Making this model work requires the upload handler to save the file properly and return the created record.

## When Is It Updated

| Trigger                                                   | What Changes                              |
| --------------------------------------------------------- | ----------------------------------------- |
| Admin edits alt text or descriptive information           | The metadata field                        |
| Admin renames a file for clarity                          | The filename                              |
| File is soft-deleted                                      | The deletion timestamp is set             |
| Image variants are generated (thumbnails, modern formats) | Metadata, to record the variant addresses |

The file's actual content is never modified in place. Replacing an image means uploading a new one and repointing the reference — which preserves the history of what was previously shown.

## When Is It Deleted

**Soft deleted** — a deletion timestamp is set rather than the row being removed.

**Why:**

Files are referenced from eight different places. Removing a row outright would leave those references pointing at nothing. Soft deletion means the file disappears from the media library while any product still referencing it degrades gracefully to a placeholder rather than erroring.

Every one of those eight references is also configured to **clear itself** if the file record is ever truly removed — so even a hard delete would empty the reference rather than deleting the product. That distinction is worth understanding: a product _owns_ its media rows (delete the product, the media goes too), but it merely _references_ a file (delete the file, the reference is cleared).

**Two warnings:**

1. **⚠ Nothing filters out deleted files when reading.** The listing endpoint returns them regardless. Soft deletion is currently decorative.
2. **Soft deletion does not remove the actual file from storage.** The image is still sitting there, still publicly reachable by anyone who noted its address. For a genuine takedown — a legal request, a leaked image — the stored file must be removed too.

## Complete Workflow

```
 1. Someone selects a file to upload
 2. Upload endpoint receives it
      ⚠ TODAY: it stops here — logs the file, replies, saves nothing
      ── everything below is how it SHOULD work ──
 3. Confirm the uploader is signed in                   ⚠ not done today
 4. Check the file really is the type it claims to be   ⚠ not done today
 5. Check it is not too large
 6. Save it to proper storage
 7. Generate smaller versions and modern formats
 8. Create an AuthFile row with address, type, size, and details
 9. Return the record, including its reference
10. Reference attached to whatever needs it —
    a product photo, a banner, an avatar, an ad creative
11. Storefront displays the image, ideally through a CDN
12. The same file may be reused elsewhere with no second upload
13. Admin removes it → deletion timestamp set
14. Reads exclude it → it vanishes from the library
15. Anything still referencing it falls back to a placeholder
16. A cleanup job eventually removes files that are
    both deleted and referenced by nothing            ⚠ not built
```

## Features

| Feature                       | Explanation                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------- |
| **Reuse across the platform** | One file, eight possible consumers, one stored copy.                            |
| **Any media type**            | Images, animations, video, audio, documents, archives.                          |
| **Soft deletion**             | Removal without breaking anything that referenced it.                           |
| **Flexible metadata**         | Dimensions, alt text, storage keys, generated variants — all in one open field. |
| **Storage independence**      | Consumers hold a reference, not an address.                                     |
| **Safe detachment**           | All eight references clear themselves rather than cascading a deletion.         |
| **Size tracking**             | Enables storage reporting and future quotas.                                    |
| **Type tracking**             | Enables policy and correct rendering.                                           |

## Relationships

### Has Many

`AuthFile` is referenced by eight different models. In every case the relationship is the same shape: **one file, many things using it.**

| Referenced By               | Why This Relationship Exists                                                                                                                  |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **`AuthUser`** (avatar)     | Avatars are just files. Reusing the shared registry means profile pictures get CDN delivery and safe deletion without a second upload system. |
| **`CatalogProductMedia`**   | The main use. That model adds ordering, alt text, and a "main image" flag on top of the raw file.                                             |
| **`SupplierProductImage`**  | Supplier photos copied into platform storage, so a listing does not break when a supplier changes their website.                              |
| **`SupplierVariantImage`**  | The same, for individual variants — each colour has its own photo.                                                                            |
| **`CatalogCollection`**     | The hero image for a curated set.                                                                                                             |
| **`CatalogCollectionItem`** | An override image for one slot within a collection.                                                                                           |
| **`CmsBanner`**             | Storefront banner images.                                                                                                                     |
| **`MarketingSocialAd`**     | Ad creatives. Lets a product photograph be reused as an ad with no duplication.                                                               |

### Belongs To / Has One / Many-to-Many

**None.** `AuthFile` points at nothing. Everything points at it.

This makes it the most widely referenced model in the entire schema, and the only one that crosses _every_ boundary — identity, catalog, CMS, marketing, and supplier integration. It also crosses the tenant boundary: product media and banners belong to specific storefronts, but the file itself does not. The same file row can legitimately be used by two different storefronts.

That last point matters, and it is why the unrestricted file-listing endpoint described below is a real problem rather than a theoretical one.

## Important Fields

### `fileUrl`

- **What it stores:** where the file can actually be fetched.
- **Why it exists:** it is the entire point of the record.
- **Who updates it:** the upload process; a storage migration.
- **When it changes:** rarely — mainly if storage moves.
- **Example value:** `https://cdn.example.com/files/2026/08/3f9c1e77-hero.jpg`
- **Business impact:** the single place that changes when storage moves. **⚠ Marked optional, which makes no sense** — a file record without an address identifies nothing. Should be required.

### `filename`

- **What it stores:** the original name of the uploaded file.
- **Why it exists:** for display in the library and for sensible download names.
- **Who updates it:** set at upload; editable by admins.
- **When it changes:** when renamed for clarity.
- **Example value:** `summer-collection-hero.jpg`
- **Business impact:** ⚠ also optional, and also should not be. **Must never be trusted as a storage path** — a crafted filename could otherwise escape the intended folder. Must also be escaped when displayed, or a filename containing script could run in the admin dashboard.

### `mimeType`

- **What it stores:** what kind of file this is.
- **Why it exists:** to render it correctly and to enforce what is allowed.
- **Who updates it:** the upload process.
- **When it changes:** never.
- **Example value:** `image/jpeg`
- **Business impact:** **must be determined by inspecting the file itself, not by trusting what the uploader claims.** A program renamed to end in `.jpg` will happily claim to be an image. ⚠ No such check exists.

### `fileSize`

- **What it stores:** size in bytes.
- **Why it exists:** storage reporting and quotas.
- **Who updates it:** the upload process.
- **When it changes:** never.
- **Example value:** `842713`
- **Business impact:** the field's numeric type tops out around 2.1 GB. Fine for images, **not sufficient for large video files**, which is worth knowing before video campaigns are launched.

### `deletedAt`

- **What it stores:** when the file was removed, or nothing if still live.
- **Why it exists:** removal without breakage.
- **Who updates it:** admins.
- **When it changes:** at deletion.
- **Example value:** `null`
- **Business impact:** **⚠ currently ignored on read.** Deleted files still appear in listings. Every read needs to exclude them for this field to mean anything.

### `metaData`

- **What it stores:** anything else worth recording — dimensions, alt text, storage keys, checksums, generated variants.
- **Why it exists:** so new needs do not require new columns.
- **Who updates it:** the upload process; admins editing alt text.
- **When it changes:** when descriptive information is edited or variants are generated.
- **Example value:** `{ "width": 2400, "height": 1350, "altText": "Model wearing the summer linen collection" }`
- **Business impact:** alt text lives here, which matters for both accessibility and search ranking. Flexible, but not searchable without extra work.

## Admin Capabilities

| Capability                   | Available Today                                                      |
| ---------------------------- | -------------------------------------------------------------------- |
| **Upload**                   | Partially — the file is received but never registered                |
| **Browse the library**       | ⚠ Returns 10 arbitrary files with no filtering, ordering, or scoping |
| **Search or filter by type** | Not built                                                            |
| **Edit alt text**            | Not built                                                            |
| **Soft delete**              | Not built                                                            |
| **See where a file is used** | Not built — and genuinely important before deleting anything         |
| **Bulk upload**              | Not built                                                            |
| **Storage usage report**     | Data exists; no report                                               |
| **Replace a file**           | Not built                                                            |

## Customer Interaction

Customers interact with this model **more than any other, and never knowingly.**

Every product photo, every banner, every collection image on the storefront comes from a row here. Image loading speed is one of the biggest factors in whether a shopper stays or leaves, so this model has a direct and measurable effect on conversion.

**Directly**, a customer might upload an avatar. That is the only place they knowingly create a file.

There is one inconsistency worth noting: **review photos do not use this model.** `ReviewImage` stores a plain web address instead of a file reference, which means customer review photos sit outside the registry entirely — no soft deletion, no type checking, no size accounting. It is the one place the pattern was not followed.

## Backend Usage

| Mechanism                    | How It Is Involved                                                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **APIs**                     | Should serve upload and library endpoints. Currently one unrestricted listing endpoint.                            |
| **Background workers**       | Supplier syncs copy supplier images into platform storage.                                                         |
| **Scheduled jobs**           | Should reconcile the database against storage and remove unused files. ⚠ Not built, so storage costs grow forever. |
| **Image processing**         | Should generate thumbnails and modern formats at upload. Not built.                                                |
| **CDN**                      | Files should be served through a CDN, not directly from the application.                                           |
| **Webhooks / Notifications** | No involvement.                                                                                                    |
| **Reports**                  | Storage usage. Not built.                                                                                          |

## Business Rules

| #   | Rule                                                                 | Enforced?                                     |
| --- | -------------------------------------------------------------------- | --------------------------------------------- |
| 1   | Only signed-in users may upload                                      | ❌ **The upload endpoint is completely open** |
| 2   | Only permitted file types may be uploaded                            | ❌ Not checked                                |
| 3   | Type must be verified by inspecting the file, not trusting the claim | ❌ Not checked                                |
| 4   | Uploads must be size-limited                                         | ⚠ Depends on upload configuration             |
| 5   | The uploader's filename must never be used as a storage path         | ❌ Not enforced                               |
| 6   | Every file must have an address                                      | ❌ Field is optional                          |
| 7   | Deleted files must not appear in listings                            | ❌ Not filtered                               |
| 8   | Consumers must reference a file, never store an address directly     | ⚠ Followed everywhere except review images    |
| 9   | Removing a file must clear references, not delete products           | ✅ Correctly configured                       |
| 10  | Listings must be paginated and consistently ordered                  | ❌ Fixed at 10, unordered                     |
| 11  | Files should be scanned for malicious content                        | ❌ Not implemented                            |
| 12  | Storage should be reconciled against the database                    | ❌ Not implemented                            |

**Rules 1 and 2 together are the most serious problem in this entire document.** The upload endpoint requires no sign-in and checks nothing about what is uploaded. Anyone on the internet can send files to the server, of any type, as many times as they like. This must be closed before the platform is publicly reachable.

## Example Scenario

**One photograph, three jobs.**

The marketing team commissions a photograph for the summer campaign: a model in linen against a beach backdrop.

Danilo uploads it once. A file record is created with its address, type, size, dimensions, and alt text.

He then uses that same reference in three places:

1. As the hero banner on the fashion storefront homepage.
2. As the cover image for the "Summer Linen" collection.
3. As the creative for a Meta ad campaign.

**One upload. One stored file. Three uses.** If the image is later replaced with a retouched version, one upload and three reference updates handle it — and the old image stays intact in any historical record that referenced it.

In September the campaign ends. Danilo soft-deletes the file. It disappears from the media library. The banner and collection fall back to placeholders rather than showing broken images. The ad campaign record keeps its history intact.

Months later a cleanup job notices the file is both deleted and no longer referenced by anything, and removes it from storage for good — reclaiming the space. ⚠ _That last step does not happen today, because the job does not exist._

**Now the cautionary version.** Because the upload endpoint requires no sign-in, someone finds it and scripts a loop uploading large files. Nothing checks who they are, what they are sending, or how much. The disk fills. The database, sharing that disk, stops accepting writes. The storefront goes down — not through a clever attack, but because an endpoint was left open.

## Summary

`AuthFile` is quietly one of the most important models in the platform. It is referenced from more places than anything else, it crosses every domain boundary, and it directly affects how fast the storefront feels to shoppers.

Its design is sound. The reference-rather-than-address pattern is exactly right, and the choice to clear references rather than cascade deletions is correct and carefully done.

But it is the least finished model in this module. The upload endpoint does not register files, so the registry cannot be populated. That same endpoint requires no sign-in and validates nothing. The listing endpoint returns arbitrary files to anyone. Soft deletion is not honoured on read. Nothing ever cleans up storage.

None of these require schema changes. They are all gaps in the surrounding code, and closing them — starting with locking down the upload endpoint — turns a well-designed model into a working one.

---

---

# Part 1 Summary

## What These Four Models Do Together

```
A person signs up            →  AuthUser        (who they are)
They stay signed in          →  AuthSession     (where they are signed in)
They use Google instead      →  AuthSocialAccount (who they are elsewhere)
They upload a photo          →  AuthFile        (what they uploaded)
```

None of these carry a storefront. That is what lets one login work everywhere. The moment a person actually _shops_, a `CommerceCustomer` is created — and from there onward, everything is storefront-specific.

## Maturity at a Glance

| Model               | Design     | Implementation                      | Verdict                                                       |
| ------------------- | ---------- | ----------------------------------- | ------------------------------------------------------------- |
| `AuthUser`          | Strong     | Mostly working, gaps in enforcement | **Usable**, needs the suspension and verification gaps closed |
| `AuthSession`       | Strong     | Well implemented                    | **The best model in the module**                              |
| `AuthSocialAccount` | Reasonable | Nothing writes to it                | **Not functional** — needs the whole flow built               |
| `AuthFile`          | Strong     | Upload disconnected, endpoint open  | **Not functional and currently unsafe**                       |

## The Ten Things Most Worth Fixing

Ordered by how much damage they can do:

| #   | Problem                                             | Model               | Why It Matters                                          |
| --- | --------------------------------------------------- | ------------------- | ------------------------------------------------------- |
| 1   | Upload endpoint requires no sign-in                 | `AuthFile`          | Anyone on the internet can upload anything              |
| 2   | File listing returns arbitrary files to anyone      | `AuthFile`          | Exposes files across every storefront                   |
| 3   | Suspension does not actually suspend                | `AuthUser`          | Admins believe they have blocked someone; they have not |
| 4   | Session tokens stored readable                      | `AuthSession`       | A database leak hands over every live login             |
| 5   | Provider tokens stored readable                     | `AuthSocialAccount` | A leak hands over sellers' advertising accounts         |
| 6   | Email verification defaults to verified             | `AuthUser`          | The check exists in name only                           |
| 7   | No password reset                                   | `AuthUser`          | A forgotten password means a lost account               |
| 8   | Same provider identity can link to several accounts | `AuthSocialAccount` | Account-takeover route                                  |
| 9   | Upload never registers a file                       | `AuthFile`          | The media library cannot be filled                      |
| 10  | No limit on repeated login attempts                 | `AuthUser`          | Passwords can be guessed at speed                       |

**Items 1 and 2 are exploitable right now by anyone who finds the endpoints.** Everything else needs either a leak or an insider. If only one thing gets done this week, it should be those two.

## Where the Design Is Genuinely Good

It is worth being specific about this, because most of the above is critical:

- **Splitting identity from commerce** is the right call and matches how Shopify solves the same problem.
- **Session rotation is properly built** — single-use tokens, ownership checked, cross-account replay blocked.
- **Password hashes are upgraded automatically at login**, which is the textbook approach and easy to get wrong.
- **The trimmed public profile** deliberately keeps the password hash out of responses and out of the cache, with a comment explaining exactly why.
- **File references clear rather than cascade**, correctly distinguishing "this belongs to me" from "I merely point at this."
- **Sessions are hard-deleted** — a considered exception to the platform's usual soft-delete rule, and the right one.

The foundations are sound. The gaps are in the code around them, not in the shape of the data.

---

**End of Part 1 — Authentication & User Management**

---

---

# Part 2 — Multi-Tenant Store Management

**Model covered:** `Tenant`

Part 1 covered the identity layer, which sits _above_ storefronts. This part covers the storefront itself — the thing almost every other table in the schema belongs to.

---

---

# Tenant

## Overview

A `Tenant` is **one storefront**.

The platform does not run a single shop. It runs several, each with its own web address, its own products, its own look, and its own orders:

- `fashion.example.com` — clothing
- `beauty.example.com` — cosmetics
- `sports.example.com` — sportswear

Each of those is one row in this table. The team calls them **verticals**.

They are not separate installations. They share one codebase, one database, one set of user accounts, and one set of supplier connections. What separates them is a single column — `tenantId` — carried on roughly thirty-five other tables.

**Its role in the platform:** `Tenant` is the boundary that keeps one shop's data out of another's. Nearly every query in the system is filtered by it. If that filtering is wrong anywhere, one storefront leaks into another — which is why the enforcement described below matters so much.

## Purpose

**The business problem it solves:** launching a new storefront should not mean deploying a new application.

Without multi-tenancy, adding a sportswear vertical means a second server, a second database, a second deployment pipeline, and a second set of migrations to keep in sync. Ten verticals means ten of everything, and the operational cost grows faster than the revenue does.

With `Tenant`, launching a new vertical is **inserting one row**. It immediately has its own catalog, its own CMS, its own orders, and its own analytics.

**Why it is necessary:**

1. **Separation.** Fashion's products must not appear in Beauty's catalog.
2. **Independent presentation.** Each storefront has its own name, theme, logo, and domain.
3. **Independent lifecycle.** One vertical can be suspended without touching the others.
4. **Shared foundations.** Users, customers, files, and supplier integrations are deliberately shared, so a shopper has one login and a supplier is connected once.

## Where It Is Used

`Tenant` has the widest reach of any model in the schema. It is not so much "used in places" as "present in nearly every query."

| Area                       | How It Is Used                                                                                                                                                                                             |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Every incoming request** | Middleware resolves which storefront the request is for _before anything else runs_, and stores it for the rest of the request. This is the single most-executed piece of tenant logic in the system.      |
| **Catalog**                | Categories, products, variants, collections, and attributes all belong to one storefront. A product created in Fashion is invisible in Beauty.                                                             |
| **Customer Storefront**    | Decides which catalog to show, which theme to apply, which banners and announcements to render.                                                                                                            |
| **Checkout**               | Carts and orders are storefront-specific. Your Fashion cart and Beauty cart are separate, even though you are one person.                                                                                  |
| **CMS**                    | Pages, banners, announcements, and FAQs are per storefront.                                                                                                                                                |
| **Inventory**              | Stock locations and stock levels are per storefront.                                                                                                                                                       |
| **Marketing**              | Ad campaigns, product feeds, and tracking links are per storefront.                                                                                                                                        |
| **Analytics**              | Every report is scoped. "Top products" always means "top products _in this storefront_."                                                                                                                   |
| **Promotions & Coupons**   | A discount code created in Fashion does not work in Beauty.                                                                                                                                                |
| **Tax**                    | Tax classes and rates are per storefront, since verticals may sell into different jurisdictions.                                                                                                           |
| **Supplier Integration**   | **Split deliberately.** Supplier _connections_ are shared platform-wide; supplier _sync jobs_ are per storefront. Connect a supplier once, then import their products into whichever verticals you choose. |
| **Authentication**         | **Not used at all.** Accounts are platform-wide. This is the deliberate exception explained in Part 1.                                                                                                     |
| **Admin Dashboard**        | Staff switch between storefronts; every list they see is filtered to the one they are in.                                                                                                                  |
| **APIs**                   | Every scoped endpoint reads the resolved storefront rather than accepting one from the caller — an important security property, covered below.                                                             |
| **Mobile App**             | Sends a header naming the storefront, since a mobile app has no subdomain.                                                                                                                                 |

## Who Uses It

| Actor                      | What They Do With It                                                                                                                                                                                              |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Customer**               | Uses it constantly without knowing. Visiting `fashion.example.com` _is_ selecting a tenant. They never see the word.                                                                                              |
| **Guest**                  | Same — resolution happens before any question of who they are.                                                                                                                                                    |
| **Admin**                  | Creates storefronts, edits names and themes, connects custom domains, suspends verticals.                                                                                                                         |
| **Seller**                 | **Can create and edit storefronts.** The `SELLER` role is explicitly granted these routes. See _Business Rules_ — this is broader than it first appears.                                                          |
| **Marketing Team**         | Works within a storefront; campaigns are scoped to one.                                                                                                                                                           |
| **Warehouse Staff**        | Inventory locations belong to a storefront.                                                                                                                                                                       |
| **System Background Jobs** | **Must explicitly re-enter a storefront's context.** A job has no incoming web request to resolve from, so it must state which storefront it is acting for. There is a dedicated helper for exactly this.         |
| **Supplier**               | No direct access. Supplier connections sit above the storefront boundary.                                                                                                                                         |
| **API**                    | Resolves the storefront on every request and caches the result for five minutes.                                                                                                                                  |
| **Payment Gateway**        | **A special case.** Payment webhooks arrive from outside with no storefront context at all — no subdomain, no header. The code deliberately reads the storefront from the _order_ the payment belongs to instead. |
| **Scheduler**              | Runs per-storefront jobs such as supplier syncs.                                                                                                                                                                  |

## When Is It Created

A record is created when an administrator or seller launches a new vertical, via `POST /tenants`.

That is the only path. There is no self-service signup, no automatic provisioning, no creation during seeding beyond fixtures.

**What happens at creation:**

1. The chosen slug is checked against a **reserved list** — `www`, `api`, `admin`, `app`, `cdn`, `static`, `assets`, `mail`, `smtp`, `docs`, `status`, `staging`. These are refused because a tenant becomes `<slug>.example.com`, and a tenant named `api` would collide with the platform's own API hostname.
2. The slug is checked for uniqueness.
3. If a custom domain was supplied, it is checked for uniqueness too.
4. The row is inserted with status `ACTIVE`.

The new storefront is live immediately. It has no products, no pages, and no content — but it resolves, and staff can begin filling it.

## When Is It Updated

| Trigger                                 | What Changes         | Who Does It     |
| --------------------------------------- | -------------------- | --------------- |
| Rebranding                              | `name`               | Admin or seller |
| Theme, logo, or contact details changed | `settings`           | Admin or seller |
| Custom domain connected or changed      | `domain`             | Admin or seller |
| Storefront taken offline                | `status → SUSPENDED` | Admin           |
| Storefront brought back                 | `status → ACTIVE`    | Admin           |
| Storefront retired                      | `status → DELETED`   | Admin           |

**The slug is never updated.** Nothing in the code changes it, and nothing should — the slug is the storefront's web address. Changing it breaks every existing link, every bookmark, and every search engine result pointing at the old address.

> **⚠ Important gap:** updating a tenant **does not clear the cache**. Storefront lookups are cached for five minutes, and nothing invalidates those entries when a tenant changes. Suspending a storefront therefore keeps serving it for up to five minutes afterward. Same for a domain change or a rename. This is covered in detail under _Business Rules_.

## When Is It Deleted

**Never actually deleted.** The status is set to `DELETED` instead.

There is no delete endpoint, and the data layer has no delete method. This is deliberate on every level.

**Why:**

A storefront owns an enormous amount of data — products, orders, payments, invoices, customer history, analytics. Removing the row would mean either destroying all of it or leaving it pointing at nothing.

More importantly, **orders are financial records**. A business is legally required to keep them for years. Deleting a storefront that processed a million pesos of orders would destroy the record of that revenue.

**The three statuses:**

| Status      | What It Means       | What Happens                                                   |
| ----------- | ------------------- | -------------------------------------------------------------- |
| `ACTIVE`    | Trading normally    | Everything works                                               |
| `SUSPENDED` | Temporarily offline | Visitors receive a "not available" response                    |
| `DELETED`   | Retired permanently | Same as suspended in practice — the storefront stops answering |

Note that `SUSPENDED` and `DELETED` behave identically today. The distinction is one of intent — "we will bring this back" versus "this is finished" — recorded for the humans, not enforced by the code.

There is one more layer of protection worth knowing about: **the database itself will refuse to delete a tenant that has orders.** The relationship between orders and their storefront is deliberately configured to block deletion. Even someone deleting rows directly cannot remove a storefront that has traded.

## Complete Workflow

```
 1. Admin decides to launch a sportswear vertical
 2. POST /tenants with name "Sports" and slug "sports"
 3. Slug checked against the reserved list → not reserved
 4. Slug checked for uniqueness            → available
 5. Row created, status = ACTIVE
 6. DNS pointed: sports.example.com → the platform
 7. First visitor arrives at sports.example.com
 8. Middleware reads the hostname, extracts "sports"
 9. Storefront looked up and cached for 5 minutes
10. Status checked — ACTIVE, so the request proceeds
11. The storefront's ID is attached to the request context
12. Every query from here on is automatically filtered to it
13. Staff create categories, import products, build CMS pages
14. Shoppers browse, add to cart, check out
15. Orders, payments, and analytics accumulate under this storefront
16. A custom domain is connected: shop.mysports.com
17. Resolution now works by subdomain OR custom domain
18. Business decides to pause the vertical → status = SUSPENDED
19. ⚠ It keeps serving for up to 5 minutes (stale cache)
20. After the cache expires, visitors get "not available"
21. Catalog, orders, and analytics all remain intact
22. Vertical reinstated → status = ACTIVE → trading resumes
23. Or retired → status = DELETED → row and history preserved forever
```

## Features

| Feature                          | Explanation                                                                                                                                                                    |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Storefront by subdomain**      | `fashion.example.com` resolves to the Fashion storefront automatically.                                                                                                        |
| **Custom domains**               | A vertical can have its own domain — `shop.myfashion.com` — with no subdomain involved.                                                                                        |
| **Header-based selection**       | Mobile apps and server-to-server calls send a header naming the storefront, since they have no hostname to read.                                                               |
| **Development default**          | A fallback storefront can be configured so local development works without fiddling with hostnames. Not used in production.                                                    |
| **Reserved slug protection**     | Prevents a storefront being named something that would collide with platform infrastructure.                                                                                   |
| **Three-state lifecycle**        | Active, suspended, retired — without ever losing data.                                                                                                                         |
| **Per-storefront settings**      | Theme, logo, and contact details live in one flexible field, so adding a new setting needs no schema change.                                                                   |
| **Five-minute caching**          | Storefront lookups are cached, so the resolution step does not hit the database on every single request.                                                                       |
| **Fails safe, not open**         | If the storefront cannot be determined, scoped queries **refuse to run** rather than quietly returning everything. This is the most important safety property in the platform. |
| **Database-enforced separation** | Products, variants, stock, and storefront sections are physically prevented from pointing at another storefront's records.                                                     |

## Relationships

`Tenant` has roughly **thirty-five** relationships, and they all point the same way: **one storefront has many of everything.**

There are no `belongs to`, `has one`, or many-to-many relationships on this model. `Tenant` is the top of the tree; everything hangs beneath it.

Rather than listing thirty-five near-identical rows, here they are grouped by area, with the reasoning that applies to each group.

### Catalog — _why:_ products are the storefront

| Related Model           | Why This Relationship Exists                                                                       |
| ----------------------- | -------------------------------------------------------------------------------------------------- |
| `CatalogCategory`       | Each storefront organises products its own way. "Dresses" makes no sense in a sportswear vertical. |
| `CatalogProduct`        | The core reason for separation. Fashion's products must never appear in Beauty.                    |
| `CatalogProductVariant` | Sizes and colours belong to their storefront's products.                                           |
| `CatalogCollection`     | Curated sets — outfits, routines, bundles — are storefront-specific.                               |
| `CatalogAttribute`      | "Sleeve length" matters to fashion; "SPF" matters to beauty. Each storefront defines its own.      |
| `CatalogPricingRule`    | Markup strategy differs by vertical — cosmetics and sportswear carry very different margins.       |

### Commerce — _why:_ separate shops mean separate transactions

| Related Model   | Why This Relationship Exists                                                                                                             |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `CommerceCart`  | Your fashion cart and beauty cart are genuinely separate baskets.                                                                        |
| `CommerceOrder` | An order is placed at one storefront and belongs to it forever. **This relationship also blocks deleting a storefront that has traded.** |

### Content — _why:_ each storefront presents itself differently

| Related Model       | Why This Relationship Exists                                                     |
| ------------------- | -------------------------------------------------------------------------------- |
| `CmsPage`           | An "About Us" page differs per brand.                                            |
| `CmsBanner`         | Promotional imagery is brand-specific.                                           |
| `CmsAnnouncement`   | "Free shipping this week" applies to one storefront.                             |
| `CmsFAQ`            | Sizing questions differ entirely between clothing and cosmetics.                 |
| `StorefrontPage`    | Merchandised page layouts.                                                       |
| `StorefrontSection` | The rows on a homepage — best sellers, new arrivals — configured per storefront. |

### Inventory — _why:_ stock is physical and storefront-specific

| Related Model          | Why This Relationship Exists                 |
| ---------------------- | -------------------------------------------- |
| `InventoryLocation`    | Warehouses and stores serving this vertical. |
| `InventoryStock`       | Stock counts per variant per location.       |
| `InventoryTransaction` | The history of every stock movement.         |

### Marketing & Promotions — _why:_ campaigns belong to a brand

| Related Model            | Why This Relationship Exists                                               |
| ------------------------ | -------------------------------------------------------------------------- |
| `MarketingSocialFeed`    | A product feed pushed to Meta or Google contains one storefront's catalog. |
| `MarketingSocialAd`      | Ads promote one storefront's products.                                     |
| `MarketingShareableLink` | Tracking links resolve to one storefront.                                  |
| `Promotion`              | A campaign runs on one storefront.                                         |
| `Coupon`                 | A code created in Fashion must not work in Beauty.                         |

### Customer Engagement — _why:_ engagement is with a shop, not the platform

| Related Model   | Why This Relationship Exists                                           |
| --------------- | ---------------------------------------------------------------------- |
| `ProductReview` | A review is about a product, which belongs to a storefront.            |
| `Wishlist`      | Separate wishlists per storefront, same as separate carts.             |
| `Notification`  | The same person receives separate notification streams per storefront. |
| `Return`        | Returns are handled by the storefront that sold the item.              |
| `Refund`        | Same — refunds follow the selling storefront's policy and accounting.  |

### Tax — _why:_ verticals may trade in different places

| Related Model | Why This Relationship Exists |
| ------------- | ---------------------------- |
| `TaxClass`    | Product tax categories.      |
| `TaxRate`     | Rates by country and region. |

### Analytics — _why:_ reporting is only meaningful within a storefront

| Related Model            | Why This Relationship Exists                   |
| ------------------------ | ---------------------------------------------- |
| `AnalyticsProductSales`  | Best sellers, per storefront.                  |
| `AnalyticsCategorySales` | Category performance, per storefront.          |
| `AnalyticsSupplier`      | How a supplier performs _for this storefront_. |
| `AnalyticsCustomer`      | Lifetime value within this storefront.         |
| `AnalyticsDailySales`    | Daily revenue, per storefront.                 |

### Supplier — _why:_ the deliberate split

| Related Model     | Why This Relationship Exists                                                                                                                                                                                     |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SupplierSyncJob` | **Only the job is storefront-specific.** The supplier connection itself is shared platform-wide. Connect a dropshipper once, then run separate import jobs into whichever verticals should carry their products. |

### How separation is actually enforced

For most of these, the `tenantId` column is filtered by application code. For the highest-risk relationships, the **database itself now enforces it**: a product cannot reference a category from another storefront, a variant cannot belong to another storefront's product, stock cannot point at another storefront's location or variant, and a storefront section cannot display another storefront's collection.

This matters because application filtering depends on every developer remembering it forever. Database enforcement does not.

## Important Fields

### `slug`

- **What it stores:** the short name that becomes the storefront's subdomain.
- **Why it exists:** it is how a web address maps to a storefront. `fashion` becomes `fashion.example.com`.
- **Who updates it:** set at creation. **Should never change.**
- **When it changes:** never.
- **Example value:** `fashion`
- **Business impact:** unique across the platform. Checked against a reserved list at creation so a storefront cannot be named `api` or `admin` and shadow platform infrastructure. Changing it later would break every existing link and search result — treat it as permanent.

### `name`

- **What it stores:** the storefront's display name.
- **Why it exists:** what shoppers actually see — in the browser tab, in emails, in the header.
- **Who updates it:** admins and sellers.
- **When it changes:** rebranding.
- **Example value:** `Fashion Forward`
- **Business impact:** purely presentational. Safe to change at any time, unlike the slug.

### `domain`

- **What it stores:** an optional custom domain.
- **Why it exists:** so a vertical can trade under its own brand rather than as a subdomain of the platform.
- **Who updates it:** admins and sellers.
- **When it changes:** when a custom domain is connected or moved.
- **Example value:** `shop.myfashion.com`
- **Business impact:** unique across the platform, and checked for conflicts on both creation and update — two storefronts claiming the same domain would make resolution ambiguous. Optional, because most verticals run happily on a subdomain. **⚠ Changing it does not clear the cache**, so the old domain keeps resolving for up to five minutes.

### `status`

- **What it stores:** whether the storefront is trading.
- **Possible values:** `ACTIVE`, `SUSPENDED`, `DELETED`
- **Why it exists:** to take a storefront offline without losing anything.
- **Who updates it:** admins.
- **When it changes:** suspension, reinstatement, retirement.
- **Example value:** `ACTIVE`
- **Business impact:** **the highest-impact field in this model.** Checked on every single request. A non-active storefront returns "not available" to every visitor. The public storefront listing shows only active ones. **⚠ Because of the caching gap, suspension takes up to five minutes to take effect** — which matters if the reason for suspending is urgent.

### `settings`

- **What it stores:** flexible per-storefront configuration — theme colours, logo, contact details.
- **Why it exists:** so adding a new setting does not require changing the database structure.
- **Who updates it:** admins and sellers.
- **When it changes:** theme edits, branding updates.
- **Example value:** `{ "theme": { "primary": "#1a1a1a" }, "logoUrl": "https://cdn.../logo.svg", "supportEmail": "help@myfashion.com" }`
- **Business impact:** drives how the storefront looks. Flexible, but with a trade-off: because it is an open field, nothing validates its shape. A typo in a colour key fails silently at render time rather than being rejected on save.

### `id`

- **What it stores:** the storefront's internal identifier.
- **Why it exists:** it is the value carried on ~35 other tables as `tenantId`.
- **Who updates it:** never changes.
- **When it changes:** never.
- **Example value:** `a4f8c2e1-7b93-4d15-8e06-2c9f1a5d7b34`
- **Business impact:** the single most-referenced value in the entire database. Every scoped query filters on it.

## Admin Capabilities

| Capability                         | Available Today            | Notes                                                                                        |
| ---------------------------------- | -------------------------- | -------------------------------------------------------------------------------------------- |
| **Create a storefront**            | ✅ Yes                     | `POST /tenants`                                                                              |
| **List all storefronts**           | ✅ Yes                     | `GET /tenants/all`, including suspended ones                                                 |
| **View one storefront**            | ✅ Yes                     | `GET /tenants/{slug}`, active only                                                           |
| **Rename**                         | ✅ Yes                     | `PATCH /tenants/{id}`                                                                        |
| **Connect a custom domain**        | ✅ Yes                     | With conflict checking                                                                       |
| **Change theme and branding**      | ✅ Yes                     | Via the settings field                                                                       |
| **Suspend**                        | ✅ Yes                     | ⚠ Takes up to 5 minutes due to caching                                                       |
| **Reinstate**                      | ✅ Yes                     |                                                                                              |
| **Retire**                         | ✅ Yes                     | Sets status to `DELETED`; nothing is lost                                                    |
| **Delete permanently**             | ❌ Deliberately impossible | No endpoint, no data-layer method, and the database blocks it for any storefront with orders |
| **Change the slug**                | ❌ Not offered             | Would break every existing link                                                              |
| **Duplicate a storefront**         | ❌ Not built               | Would be genuinely useful for launching a similar vertical                                   |
| **Per-storefront usage reporting** | ❌ Not built               | Storage, orders, and revenue by storefront                                                   |

## Customer Interaction

Customers interact with this model on **every single page view**, and are never aware of it.

Typing `fashion.example.com` _is_ choosing a tenant. The word never appears in the interface, there is no storefront picker, and shoppers do not think of the platform as multi-tenant at all — they think they are on a shop's website.

Where it becomes visible to them:

- **A suspended storefront** returns "this storefront is not available." That is the one moment the tenancy layer surfaces.
- **Separate carts.** A shopper signed in on both Fashion and Beauty has two independent baskets. This occasionally surprises people, but it is correct — they are two different shops.
- **Separate order history.** Their Fashion orders do not appear on Beauty.

What stays shared, and is the whole point of the design: **one login works everywhere.** Explained fully in Part 1.

## Backend Usage

| Mechanism              | How It Is Involved                                                                                                                                                                                                                                                                             |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Request middleware** | Resolves the storefront before anything else runs, then stores it so every downstream function can read it without being passed it explicitly.                                                                                                                                                 |
| **Caching**            | Lookups cached for five minutes under two keys — one by slug, one by domain. ⚠ Never invalidated on update.                                                                                                                                                                                    |
| **APIs**               | Every scoped endpoint reads the _resolved_ storefront rather than accepting one from the request body. **This is a deliberate security decision** — if the caller could name the storefront, anyone could read any storefront's data by changing a value.                                      |
| **Background workers** | Have no incoming request to resolve from, so they must explicitly declare which storefront they are acting for. A dedicated helper exists for this.                                                                                                                                            |
| **Payment webhooks**   | Arrive from outside with no storefront context at all. The code reads it from the _order_ the payment belongs to — the webhook's own data becomes the source of truth.                                                                                                                         |
| **Scheduled jobs**     | Supplier syncs run per storefront.                                                                                                                                                                                                                                                             |
| **Error handling**     | If the storefront cannot be resolved, the request is **not** rejected outright — unscoped routes like health checks and login must keep working. Scoped queries then fail individually. This is intentional: a database blip should not kill health checks and get a healthy server restarted. |

## Business Rules

| #   | Rule                                                     | Enforced?                                                    |
| --- | -------------------------------------------------------- | ------------------------------------------------------------ |
| 1   | Slug must be unique platform-wide                        | ✅ Database constraint + explicit check                      |
| 2   | Custom domain must be unique platform-wide               | ✅ Database constraint + explicit check on create and update |
| 3   | Reserved slugs cannot be used                            | ✅ Blocked list at creation                                  |
| 4   | Only active storefronts are publicly visible             | ✅ Public lookup and listing both filter on it               |
| 5   | Non-active storefronts return "not available"            | ✅ Checked on every request                                  |
| 6   | Storefronts are never permanently deleted                | ✅ No endpoint, no data-layer method                         |
| 7   | A storefront with orders cannot be removed               | ✅ Enforced by the database itself                           |
| 8   | Scoped queries must refuse to run without a storefront   | ✅ Fails closed with a clear error                           |
| 9   | The storefront must never be taken from the request body | ✅ Always read from the resolved context                     |
| 10  | Products cannot reference another storefront's category  | ✅ Enforced by the database                                  |
| 11  | Variants cannot belong to another storefront's product   | ✅ Enforced by the database                                  |
| 12  | Stock cannot point at another storefront's location      | ✅ Enforced by the database                                  |
| 13  | **Updating a storefront must clear its cache**           | ❌ **Not done — changes take up to 5 minutes**               |
| 14  | **A seller should only edit their own storefront**       | ❌ **Not enforced — any seller can edit any storefront**     |
| 15  | The slug should be immutable                             | ⚠ By convention only; nothing blocks it                      |
| 16  | Settings should be validated against a known shape       | ❌ Open field, unvalidated                                   |

### The two rules worth acting on

**Rule 13 — stale cache after update.** Storefront lookups are cached for five minutes, and nothing clears those entries when a storefront changes. Suspending a storefront therefore keeps it trading for up to five minutes. If the reason for suspension is fraud or a legal takedown, five minutes is a long time. The fix is small: clear the two cache keys whenever a tenant is updated.

**Rule 14 — no storefront ownership.** Sellers are explicitly allowed to create and edit storefronts, but there is **no link recording which seller owns which storefront**. The update logic only checks that the storefront exists. In practice this means any user with the seller role can rename another seller's storefront, redirect its custom domain, or suspend it entirely.

This is not a bug in the code so much as a missing piece of the data model — there is nowhere to record ownership even if the code wanted to check it. Fixing it properly needs a link between sellers and storefronts, which is the same gap noted in Part 1 under seller functionality.

## Example Scenario

**Launching, running, and pausing a vertical.**

The business decides to add sportswear.

Danilo creates the storefront with the name "Sports Hub" and the slug `sports`. The system checks `sports` against the reserved list — fine — and against existing storefronts — available. The row is created as active. DNS is pointed at the platform.

The first visitor hits `sports.example.com`. Middleware reads the hostname, pulls out `sports`, looks up the storefront, caches it for five minutes, confirms it is active, and attaches its ID to the request. From that point on, every query the request makes is automatically limited to Sports Hub. The visitor sees an empty shop — correct, because nothing has been added yet.

Staff import 200 products from a dropshipping supplier. **The supplier connection already existed** — it was set up months ago for Fashion. Only the import job is specific to Sports Hub. This is the shared-versus-scoped split working as intended: connect a supplier once, import into many verticals.

Sports Hub trades for six months. Orders, payments, reviews, and analytics accumulate, all carrying its ID.

The brand then licenses its own domain, `shop.sportshub.ph`. Danilo connects it. The system checks no other storefront has claimed it and saves it. Resolution now works both ways — subdomain and custom domain.

**Then something goes wrong.** A pricing error puts every product at a fraction of its cost. Danilo suspends the storefront immediately.

**Orders keep coming in for the next four minutes.** The storefront is cached, and nothing cleared that cache when the status changed. Shoppers who arrive during that window are served a perfectly functional shop selling goods at a loss. Only once the five-minute cache expires does the storefront start returning "not available."

_This is Rule 13, and this is why it is worth fixing._

Once the pricing is corrected, Danilo reinstates the storefront. Nothing was lost — the catalog, the orders, the analytics, and the customer history are all exactly as they were, because suspension only ever changed one field.

## Summary

`Tenant` is the model the rest of the schema is organised around. Roughly thirty-five tables carry its ID, and nearly every query in the platform filters on it. Getting it right is what allows one codebase and one database to run many independent shops.

The design is sound and the implementation is largely careful. Resolution tries four strategies in a sensible order. The reserved-slug list prevents a real class of collision. Scoped queries **fail closed** rather than silently returning everything — the single most important safety property in a multi-tenant system, and easy to get wrong in the other direction. Storefronts are never truly deleted, and the database itself blocks removing one that has traded. The highest-risk relationships are now enforced by the database rather than by developer discipline.

Two things are genuinely worth fixing. Cached storefronts are never invalidated, so suspending a shop takes up to five minutes to take effect. And sellers can edit any storefront, because nothing records which storefront belongs to whom.

Neither undermines the design. The first is a few lines of cache clearing. The second needs a small addition to the data model — the same seller-ownership gap identified in Part 1.

---

**End of Part 2 — Multi-Tenant Store Management**

---

---

# Part 3 — Catalog Management

**Models covered:** `CatalogCategory`, `CatalogProduct`, `CatalogProductVariant`, `CatalogProductMedia`, `CatalogSizeGuide`, `CatalogSizeEntry`

Part 1 covered who people are. Part 2 covered which shop they are in. This part covers **what the shop sells** — the merchandise itself.

## Read This First: The Catalog Is Half-Built

Before the model-by-model detail, there is one thing that shapes everything in this part and that you cannot see by reading the schema.

**The catalog schema is complete and well designed. The code that fills it is not.**

Specifically, verified by searching every write in `src/`:

| Model                   | Created by any code?                     | Consequence                                                      |
| ----------------------- | ---------------------------------------- | ---------------------------------------------------------------- |
| `CatalogProduct`        | ✅ Yes — but **only** by supplier import | No admin can manually create a product                           |
| `CatalogProductVariant` | ❌ **Never created.** Only _updated_     | Every product has zero variants — so no price and nothing to buy |
| `CatalogProductMedia`   | ❌ **Never created at all**              | Every product has zero images                                    |
| `CatalogCategory`       | ✅ Yes — full create/update/delete       | Works                                                            |
| `CatalogSizeGuide`      | ✅ Yes — full create/update/delete       | Works                                                            |
| `CatalogSizeEntry`      | ✅ Yes — full create/update/delete       | Works                                                            |

The practical effect is that an imported product is a **title, a description, and a thumbnail URL** — and nothing else. The storefront code that renders a product card asks for `media[0]` and `variants[0]`; both are always empty.

This is not a criticism of the schema. The data model handles variants, media, pricing rules, and size charts properly. What is missing is the admin-facing product management layer that would populate it.

Everything below describes both: **how the model is designed to work**, and **what actually happens today**, marked **⚠ NOT IMPLEMENTED** where they differ.

---

---

# CatalogCategory

## Overview

A `CatalogCategory` is a **folder for products** — "Dresses", "Footwear", "Skincare".

Categories nest. "Clothing" can contain "Dresses", which can contain "Evening Dresses". This is what produces the navigation menu a shopper clicks through.

Each category belongs to exactly one storefront. Fashion's "Dresses" and Beauty's "Skincare" are separate rows that never meet.

**Its role in the platform:** it is how shoppers _find_ things. Search helps people who know what they want; categories serve everyone else.

## Purpose

**The business problem it solves:** a shop with 5,000 products and no structure is unusable. Categories turn a pile of merchandise into something browsable.

**Why it is necessary:**

1. **Navigation.** The menu is built from this table.
2. **Filtering.** "Show me only dresses" is a category filter.
3. **Search rankings.** Category pages carry their own titles and descriptions, which is how they rank in Google.
4. **Reporting.** "Which category earns most?" needs categories to exist as first-class records.

## Where It Is Used

| Area                                           | How It Is Used                                                    |
| ---------------------------------------------- | ----------------------------------------------------------------- |
| **Customer Storefront**                        | The navigation menu, category landing pages, and product filters. |
| **Admin Dashboard**                            | Staff create the tree and assign products to it.                  |
| **Catalog**                                    | Every product optionally points at one category.                  |
| **Analytics**                                  | Category sales reporting rolls up through this model.             |
| **Search rankings**                            | Each category carries its own page title and description.         |
| **Marketing**                                  | Campaigns can target a category.                                  |
| **CMS**                                        | Pages can link to category listings.                              |
| **Checkout / Inventory / Supplier / Payments** | No involvement.                                                   |

## Who Uses It

| Actor                                            | What They Do With It                                                                                                                           |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Customer**                                     | Browses the menu and category pages. Never edits.                                                                                              |
| **Guest**                                        | Same — category listing and lookup are both public.                                                                                            |
| **Admin**                                        | Creates, renames, restructures, and deletes categories.                                                                                        |
| **Seller**                                       | ❌ **Not permitted.** Category routes require an admin role; sellers are excluded. Worth noting given sellers _can_ create entire storefronts. |
| **Marketing Team**                               | References categories in campaigns; does not edit them.                                                                                        |
| **System Background Jobs**                       | Analytics rolls up sales by category.                                                                                                          |
| **API**                                          | Serves the navigation tree to storefront and mobile clients.                                                                                   |
| **Supplier / Warehouse Staff / Payment Gateway** | No involvement.                                                                                                                                |

## When Is It Created

An admin creates one via `POST /v2/categories`.

The service checks the slug is not already used **within that storefront** — the same slug may exist in two different storefronts without conflict, which is correct.

Imported products do **not** create categories. A product imported from a supplier arrives with no category at all, and someone must assign one manually. ⚠ There is currently no endpoint to do that, because there is no product update endpoint.

## When Is It Updated

| Trigger                            | What Changes                 |
| ---------------------------------- | ---------------------------- |
| Renaming                           | `name`                       |
| Changing the web address           | `slug`                       |
| Editing the description            | `description`                |
| Moving it under a different parent | `parentId`                   |
| Reordering the menu                | `sortOrder`                  |
| Search-listing text edited         | `seoTitle`, `seoDescription` |

All via `PUT /v2/categories/{id}`, admin only.

The update path is written carefully: it uses a tenant-filtered update so the database itself enforces that an admin in one storefront cannot modify another storefront's category, even if they supply a valid ID from elsewhere.

## When Is It Deleted

**Hard deleted — permanently removed.**

This is worth flagging, because the model has a `deletedAt` field designed for soft deletion, and **nothing uses it.** The delete endpoint issues a real delete.

**Why that mostly turns out fine:** the database now refuses to delete a category that still has products pointing at it, and refuses to delete one that still has child categories. So a "dangerous" delete fails with a database error rather than silently orphaning anything.

**Why it is still worth fixing:** failing with a raw database error is a poor experience. The service should check for products and children first and return a clear message — "this category has 43 products, move them first" — rather than letting the constraint fire. And using the `deletedAt` field that already exists would preserve category history for past analytics.

## Complete Workflow

```
 1. Admin creates "Clothing"                      (no parent — top level)
 2. Admin creates "Dresses" with parent "Clothing"
 3. Admin creates "Evening Dresses" under "Dresses"
 4. Menu order set via sortOrder
 5. Search title and description filled in
 6. Products assigned to categories        ⚠ no endpoint exists to do this
 7. Storefront builds its navigation from the tree
 8. Shopper clicks "Dresses" → category page lists its products
 9. Shopper filters and browses
10. Orders accumulate; category sales reporting rolls up
11. Season ends → admin tries to delete "Evening Dresses"
12. Database blocks it if products or child categories still reference it
13. Admin reassigns those first, then deletes successfully
```

## Features

| Feature                            | Explanation                                                                                        |
| ---------------------------------- | -------------------------------------------------------------------------------------------------- |
| **Unlimited nesting**              | A category can contain categories, to any depth.                                                   |
| **Per-storefront slugs**           | `dresses` can exist in Fashion and Beauty simultaneously.                                          |
| **Manual menu ordering**           | `sortOrder` controls display position rather than relying on alphabetical order.                   |
| **Search-listing control**         | Separate title and description for how the page appears in Google.                                 |
| **Storefront-enforced separation** | The database physically prevents a category from being nested under another storefront's category. |
| **Safe deletion**                  | The database blocks deleting a category still in use.                                              |
| **Soft-delete field**              | Present in the schema. ⚠ Never used by any code.                                                   |

## Relationships

### Belongs To

| Relationship                                              | Why It Exists                                                                                                                                                                                                            |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **A category belongs to one `Tenant`**                    | Categories are storefront-specific. "Skincare" makes no sense in a sportswear shop.                                                                                                                                      |
| **A category may belong to one parent `CatalogCategory`** | This is what creates the tree. A category with no parent is a top-level menu item. **The database enforces that the parent is in the same storefront** — Fashion's "Dresses" cannot be nested under Beauty's "Skincare". |

### Has Many

| Relationship                                     | Why It Exists                                                 |
| ------------------------------------------------ | ------------------------------------------------------------- |
| **A category has many child `CatalogCategory`s** | The other side of the tree.                                   |
| **A category has many `CatalogProduct`s**        | The core purpose — grouping merchandise so it can be browsed. |
| **A category has many `AnalyticsCategorySales`** | Sales reporting per category.                                 |

### Has One / Many-to-Many

None. A product belongs to **one** category, not many. That is a real limitation — most mature platforms let a product appear in several categories ("Dresses" _and_ "Sale"). Adding that would need a join table.

## Important Fields

### `slug`

- **What it stores:** the short name used in the category's web address.
- **Why it exists:** `example.com/categories/evening-dresses` reads better and ranks better than an ID.
- **Who updates it:** admins.
- **When it changes:** rarely — changing it breaks existing links.
- **Example value:** `evening-dresses`
- **Business impact:** unique **within a storefront**, not globally. That is the correct scope: two shops can both have a "sale" category.

### `parentId`

- **What it stores:** which category this sits inside, or nothing if top-level.
- **Why it exists:** builds the navigation tree.
- **Who updates it:** admins restructuring the menu.
- **When it changes:** when the menu is reorganised.
- **Example value:** `null` for "Clothing", or the Clothing ID for "Dresses"
- **Business impact:** **⚠ nothing prevents a loop.** Making A the parent of B while B is already the parent of A would produce a menu that never terminates. The database cannot catch this; the service should.

### `sortOrder`

- **What it stores:** display position among sibling categories.
- **Why it exists:** merchandising order is a business decision, not alphabetical.
- **Who updates it:** admins.
- **When it changes:** menu reordering, seasonal promotion.
- **Example value:** `0`
- **Business impact:** lets "New Arrivals" sit above "Accessories" regardless of spelling.

### `seoTitle` / `seoDescription`

- **What they store:** the text Google shows for this category page.
- **Why they exist:** category pages are often the highest-traffic pages on a commerce site.
- **Who updates them:** admins and marketing.
- **When they change:** search optimisation work.
- **Example value:** `Evening Dresses | Fashion Forward`
- **Business impact:** direct effect on organic traffic, which for most commerce sites is the cheapest customer acquisition channel available.

### `deletedAt`

- **What it stores:** when the category was removed.
- **Why it exists:** to allow removal without losing history.
- **Who updates it:** nobody.
- **When it changes:** never.
- **Example value:** `null`
- **Business impact:** **⚠ entirely unused.** Deletion is permanent. The field is a good idea that was never wired up.

## Admin Capabilities

| Capability                                | Available Today                      |
| ----------------------------------------- | ------------------------------------ |
| **Create**                                | ✅ `POST /v2/categories`             |
| **View the tree**                         | ✅ `GET /v2/categories` (top level)  |
| **View one**                              | ✅ `GET /v2/categories/{slug}`       |
| **Rename / edit**                         | ✅ `PUT /v2/categories/{id}`         |
| **Re-parent**                             | ✅ Via update                        |
| **Reorder**                               | ✅ Via `sortOrder`                   |
| **Delete**                                | ✅ Hard delete, blocked if in use    |
| **Assign products to a category**         | ❌ No product update endpoint exists |
| **Bulk move products between categories** | ❌ Not built                         |
| **See product count per category**        | ❌ Not built                         |
| **Merge two categories**                  | ❌ Not built                         |

## Customer Interaction

Customers use categories constantly and directly — this is one of the few catalog models a shopper genuinely interacts with by name.

They click a menu item, land on a category page, and browse. Both the listing and lookup endpoints are **public**, requiring no login, which is correct: navigation must work for anonymous visitors or the shop is invisible to search engines.

Customers never create or edit categories.

## Backend Usage

| Mechanism                                         | How It Is Involved                                                                                                      |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **APIs**                                          | Two public read endpoints, three admin write endpoints.                                                                 |
| **Analytics jobs**                                | Roll sales up by category on order completion.                                                                          |
| **Storefront rendering**                          | The navigation tree is built from this table on page load.                                                              |
| **Caching**                                       | ⚠ Not cached, though the navigation tree is read on nearly every page view and changes rarely. An obvious optimisation. |
| **Background workers / Webhooks / Notifications** | No involvement.                                                                                                         |

## Business Rules

| #   | Rule                                                            | Enforced?                                  |
| --- | --------------------------------------------------------------- | ------------------------------------------ |
| 1   | Slug must be unique within a storefront                         | ✅ Database + explicit check               |
| 2   | A category cannot be nested under another storefront's category | ✅ Database                                |
| 3   | Admins can only edit categories in their own storefront         | ✅ Tenant-filtered update                  |
| 4   | A category with products cannot be deleted                      | ✅ Database blocks it                      |
| 5   | A category with children cannot be deleted                      | ✅ Database blocks it                      |
| 6   | Category loops must be prevented                                | ❌ Not checked                             |
| 7   | Deletion should be soft, not permanent                          | ❌ Hard delete, despite the field existing |
| 8   | Deleting an in-use category should give a clear message         | ❌ Raw database error surfaces instead     |
| 9   | Sellers cannot manage categories                                | ✅ Admin roles only                        |

## Example Scenario

**Building the Fashion menu.**

Danilo sets up the Fashion storefront's navigation. He creates "Clothing" with no parent — a top-level item. Then "Dresses" and "Tops", both with "Clothing" as parent. Then "Evening Dresses" under "Dresses".

He sets sort orders so "New Arrivals" appears first even though it starts with N. He writes search descriptions for each page.

The storefront builds its menu from the tree. Shoppers browse and buy. Category sales reports start accumulating.

After the season, Danilo tries to delete "Evening Dresses." **The database refuses** — 43 products still point at it. He gets a raw constraint error rather than a helpful message, which costs him a few minutes working out what happened.

He reassigns the 43 products to "Dresses"… except **there is no endpoint to change a product's category**, because there is no product update endpoint at all. He ends up doing it directly against the database.

_This is the gap described at the top of Part 3, showing up in ordinary daily work._

## Summary

`CatalogCategory` is one of the better-implemented models in the catalog. It has real CRUD endpoints, proper storefront isolation enforced by the database, correct per-storefront slug scoping, and careful tenant filtering on writes.

Its shortcomings are modest: deletion is permanent despite a soft-delete field sitting unused, nothing prevents a circular parent chain, and a product can only belong to one category. None of these block day-to-day use.

The real friction is external to the model — categories can be created, but products cannot be assigned to them through any API.

---

---

# CatalogProduct

## Overview

A `CatalogProduct` is **one item the shop sells** — "Urban Air Max Runner 2026", "Hydrating Vitamin C Serum".

It holds the things that describe the item as a whole: its name, its description, its photographs, its category, its search text, and whether it is visible to shoppers.

What it does **not** hold is the thing customers actually buy. Nobody buys "a running shoe" — they buy _size 42 in black_. That is a **variant**, covered in the next chapter. A product is the umbrella; variants are the sellable things underneath it.

**Its role in the platform:** it is the centre of the catalog. Collections point at it, storefront sections display it, reviews attach to it, analytics rank it, and marketing promotes it.

## Purpose

**The business problem it solves:** shoppers browse products, not variants. Showing "Urban Air Max Runner — sizes 39–45, six colours" as 42 separate listings would be unusable. The product groups them into one thing to look at.

**Why it is necessary:**

1. **One page per item.** Everything a shopper needs to decide, in one place.
2. **A publishing lifecycle.** Staff can prepare an item without shoppers seeing it.
3. **Search presence.** Product pages are the bulk of a commerce site's search traffic.
4. **A place to attach everything else** — reviews, media, collections, analytics.

## Where It Is Used

| Area                     | How It Is Used                                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------------------------------- |
| **Customer Storefront**  | Product pages, listing grids, homepage sections, search results. The most-viewed model on the site.           |
| **Admin Dashboard**      | ⚠ Should be where staff manage the catalog. **No product management endpoints exist.**                        |
| **Supplier Integration** | The only place products are created today — imported from a dropshipping supplier.                            |
| **Checkout**             | Indirectly. Carts and orders reference _variants_, but the order line stores a snapshot of the product title. |
| **Collections**          | Curated sets — outfits, bundles — point at products.                                                          |
| **Storefront sections**  | Homepage rows (best sellers, new arrivals, featured) are lists of products.                                   |
| **Marketing**            | Ads and tracking links target a product.                                                                      |
| **Analytics**            | Sales rollups are keyed by product.                                                                           |
| **CMS**                  | Pages can feature products through collections.                                                               |
| **Inventory**            | Indirectly — stock lives on variants.                                                                         |

## Who Uses It

| Actor                      | What They Do With It                                                                                      |
| -------------------------- | --------------------------------------------------------------------------------------------------------- |
| **Customer**               | Views, searches, filters, adds to cart, reviews.                                                          |
| **Guest**                  | Same, minus reviewing.                                                                                    |
| **Admin**                  | ⚠ _Should_ create, edit, publish, and archive. **Cannot** — no endpoints exist. Import is the only route. |
| **Seller**                 | Same limitation.                                                                                          |
| **Marketing Team**         | Selects products for campaigns and collections.                                                           |
| **Supplier**               | Indirectly — their catalog becomes products through import.                                               |
| **System Background Jobs** | Import creates products; sync updates supplier-side data; analytics ranks them.                           |
| **API**                    | Serves products to storefront and mobile clients.                                                         |
| **Warehouse Staff**        | Indirectly, through variants.                                                                             |
| **Payment Gateway**        | No involvement.                                                                                           |

## When Is It Created

**Only by supplier import.** `POST /v2/products/import`, admin only.

The import does the following:

1. Pulls the title, description, and thumbnail from the supplier's data.
2. Builds a slug by lowercasing the title, stripping punctuation, replacing spaces with hyphens, and **cutting it at 200 characters**.
3. Creates or updates the product keyed on storefront + slug.
4. Sets the status to **`PUBLISHED` immediately**.
5. Creates a linked `SupplierProduct` holding the raw supplier data and the cost price.

Three things about that are worth knowing:

> **⚠ Imported products go straight live.** The status is set to `PUBLISHED` on import, skipping `DRAFT` and `READY` entirely. Nobody reviews the supplier's title, description, or pricing before shoppers can see it.

> **⚠ The slug can collide.** Because it is derived from the title and truncated at 200 characters, two supplier products with similar long titles produce the same slug — and because the operation is an upsert keyed on that slug, **the second one silently overwrites the first.**

> **⚠ No price is set.** The cost price is stored on the supplier record, not on the product. The product's own price fields are left empty, and since no variants are created either, there is nothing anywhere holding a sellable price.

## When Is It Updated

| Trigger                       | What Changes                          | Available?     |
| ----------------------------- | ------------------------------------- | -------------- |
| Re-import of the same product | Title, description, thumbnail, status | ✅ Works       |
| Admin edits any detail        | Any field                             | ❌ No endpoint |
| Publishing or archiving       | `status`                              | ❌ No endpoint |
| Marking as featured           | `featured`                            | ❌ No endpoint |
| Price change                  | Price fields                          | ❌ No endpoint |
| Pricing rule applied          | `pricingRuleId`                       | ❌ No endpoint |
| Assigning a category          | `categoryId`                          | ❌ No endpoint |
| Search text edited            | `seoTitle`, `seoDescription`          | ❌ No endpoint |

Re-importing is the only working update path, and it overwrites four fields with whatever the supplier currently says.

## When Is It Deleted

**Designed for soft deletion** — the model has a `deletedAt` field.

⚠ **Nothing deletes products at all.** There is no delete endpoint and no code that sets `deletedAt`.

Soft deletion is the right design when it is eventually built, because products are referenced by order lines, reviews, collections, and analytics. Hard deletion would either destroy sales history or break those references.

Note that `ARCHIVED` (a status) and `deletedAt` (a timestamp) mean different things: archived is "we stopped selling this but it stays in the records"; deleted is "this should not have existed."

## Complete Workflow

**As designed:**

```
 1. Admin creates a product                       ⚠ no endpoint
 2. Photographs uploaded and attached             ⚠ never created
 3. Variants added — sizes, colours, prices       ⚠ never created
 4. Category assigned                             ⚠ no endpoint
 5. Pricing rule attached                         ⚠ no endpoint
 6. Status moves DRAFT → READY after review       ⚠ no endpoint
 7. Published → shoppers can see it               ⚠ no endpoint
 8. Appears in listings, search, and homepage rows
 9. Shopper opens the product page, picks a variant
10. Adds to cart, checks out
11. Stock decreases on the variant
12. Analytics rolls up the sale
13. Season ends → archived
```

**What actually happens today:**

```
 1. Admin calls the import endpoint with a supplier product ID
 2. Product created — title, description, thumbnail only
 3. Status set straight to PUBLISHED
 4. Supplier record created holding raw data and cost price
 5. Product is live and visible on the storefront
 6. Product page renders with no images and no variants
 7. Nothing is buyable, because there is no variant to add to a cart
```

## Features

| Feature                                                        | Designed | Working                              |
| -------------------------------------------------------------- | -------- | ------------------------------------ |
| Four-stage lifecycle (draft → ready → published → archived)    | ✅       | ⚠ Import jumps straight to published |
| Four visibility levels (public, private, hidden, members-only) | ✅       | ❌ **Never read by any code**        |
| Featured flag for homepage placement                           | ✅       | ⚠ No way to set it                   |
| Three price fields (price, sale price, was-price)              | ✅       | ⚠ Never populated                    |
| Structured discount details                                    | ✅       | ⚠ Never populated                    |
| Free-text tags                                                 | ✅       | ⚠ Never populated                    |
| Search title and description                                   | ✅       | ⚠ No way to set them                 |
| Quick-access thumbnail                                         | ✅       | ✅ Set by import                     |
| Publication timestamp                                          | ✅       | ⚠ Never set                          |
| Created-by / updated-by tracking                               | ✅       | ⚠ Never set                          |
| Soft deletion                                                  | ✅       | ❌ Never used                        |
| Category, pricing rule, and tax class links                    | ✅       | ⚠ Never set                          |

The pattern is consistent: **the model supports far more than the code exercises.**

## Relationships

### Belongs To

| Relationship                                         | Why It Exists                                                                                                                                                      |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **A product belongs to one `Tenant`**                | Products are the main reason storefronts are separated at all.                                                                                                     |
| **A product may belong to one `CatalogCategory`**    | Categories are how shoppers browse. Optional, because an imported product arrives uncategorised. **The database enforces the category is in the same storefront.** |
| **A product may belong to one `CatalogPricingRule`** | Lets a markup strategy be applied automatically rather than pricing each item by hand. Same-storefront enforced.                                                   |
| **A product may belong to one `TaxClass`**           | Different goods are taxed differently. Same-storefront enforced.                                                                                                   |

### Has Many

| Relationship                       | Why It Exists                                                                                                                                   |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Many `CatalogProductVariant`s**  | The actual sellable things — size 42 in black. **This is the most important relationship in the catalog**, and the one that is never populated. |
| **Many `CatalogProductMedia`**     | Photographs and video. Also never populated.                                                                                                    |
| **Many `CatalogSizeGuide`s**       | Size charts.                                                                                                                                    |
| **Many `SupplierProduct`s**        | Links to the supplier records this product came from. Several suppliers can offer the same item.                                                |
| **Many `ProductReview`s**          | Customer reviews attach to the product, not the variant — a review of a shoe is about the shoe, not size 42.                                    |
| **Many `AnalyticsProductSales`**   | Sales rollups.                                                                                                                                  |
| **Many `CatalogCollectionItem`s**  | Membership in curated sets.                                                                                                                     |
| **Many `MarketingSocialAd`s**      | Ads promoting it.                                                                                                                               |
| **Many `MarketingShareableLink`s** | Tracking links pointing at it.                                                                                                                  |
| **Many `StorefrontSectionItem`s**  | Manual placement in homepage rows.                                                                                                              |

### Many-to-Many

None directly, though collections and storefront sections both act as join tables in practice.

## Important Fields

### `status`

- **What it stores:** where the product is in its lifecycle.
- **Possible values:** `DRAFT`, `READY`, `PUBLISHED`, `ARCHIVED`
- **Why it exists:** so staff can prepare an item without shoppers seeing it.
- **Who updates it:** should be admins; currently only the import, which always sets `PUBLISHED`.
- **When it changes:** on import only.
- **Example value:** `PUBLISHED`
- **Business impact:** **⚠ only two of the eight storefront display strategies actually check it.** `featured` and `new arrivals` filter correctly. `best sellers`, `trending`, `collection`, `flash sale`, `manual`, and `recommended` **do not** — so a draft or archived product that appears in any of those will be shown to shoppers.

### `visibility`

- **What it stores:** who is allowed to see the product.
- **Possible values:** `PUBLIC`, `PRIVATE`, `HIDDEN`, `MEMBERS_ONLY`
- **Why it exists:** for members-only ranges, unlisted items, and soft launches.
- **Who updates it:** should be admins.
- **When it changes:** never.
- **Example value:** `PUBLIC`
- **Business impact:** **⚠ this field is never read anywhere in the codebase.** A product marked `MEMBERS_ONLY` or `HIDDEN` is displayed to everyone exactly like a public one. If someone builds a members-only range trusting this field, it will not be private.

### `slug`

- **What it stores:** the product's web address.
- **Why it exists:** readable, search-friendly URLs.
- **Who updates it:** the import, derived from the title.
- **When it changes:** on re-import if the supplier changes the title.
- **Example value:** `urban-air-max-runner-2026`
- **Business impact:** unique within a storefront. **⚠ Generated by truncating the title at 200 characters, and used as the upsert key** — two long, similar supplier titles collapse into one slug and the second import silently overwrites the first.

### `price` / `salePrice` / `compareAtPrice`

- **What they store:** the headline price, the discounted price, and the crossed-out "was" price.
- **Why they exist:** so a listing grid can show a price without loading every variant.
- **Who updates them:** should be admins or the pricing engine.
- **When they change:** never, currently.
- **Example value:** `4999.0000`
- **Business impact:** these are **display** prices. The price actually charged comes from the variant. They are stored to four decimal places following the platform-wide money standard. ⚠ Never populated by any code path.

### `featured`

- **What it stores:** whether to highlight this product.
- **Why it exists:** merchandising — the homepage "featured" row is built from it.
- **Who updates it:** should be admins.
- **When it changes:** never.
- **Example value:** `false`
- **Business impact:** the `featured` storefront strategy reads this correctly, filtering on published and not-deleted. It is one of the two strategies that gets visibility right — but nothing can set the flag.

### `thumbnailUrl`

- **What it stores:** the main image address.
- **Why it exists:** a shortcut so listing grids do not have to join to the media table.
- **Who updates it:** the import.
- **When it changes:** on re-import.
- **Example value:** `https://cdn.supplier.com/img/12345.jpg`
- **Business impact:** **currently the only image a product has**, since media rows are never created. Note it points at the _supplier's_ server, not the platform's — if the supplier removes the image, the product page breaks.

### `tags`

- **What it stores:** free-text labels.
- **Why it exists:** flexible grouping without creating categories.
- **Who updates it:** should be admins.
- **When it changes:** never.
- **Example value:** `["summer", "linen", "bestseller"]`
- **Business impact:** would support "shop the summer edit" style filtering. Unused.

### `deletedAt`

- **What it stores:** when the product was removed.
- **Why it exists:** removal without destroying order history.
- **Who updates it:** nothing.
- **When it changes:** never.
- **Example value:** `null`
- **Business impact:** only two storefront strategies filter on it, so even once soft deletion is built, deleted products would still surface through the other six.

### `createdBy` / `updatedBy`

- **What they store:** who created and last edited the product.
- **Why they exist:** accountability for catalog changes.
- **Who updates them:** should be the product endpoints.
- **When they change:** never.
- **Example value:** `null`
- **Business impact:** would answer "who published this at the wrong price?" Currently always empty.

## Admin Capabilities

| Capability                 | Available Today              |
| -------------------------- | ---------------------------- |
| **Import from a supplier** | ✅ The only working path     |
| **Create manually**        | ❌ Not built                 |
| **Edit**                   | ❌ Not built                 |
| **Publish / unpublish**    | ❌ Not built                 |
| **Archive**                | ❌ Not built                 |
| **Assign a category**      | ❌ Not built                 |
| **Set prices**             | ❌ Not built                 |
| **Add images**             | ❌ Not built                 |
| **Add variants**           | ❌ Not built                 |
| **Mark featured**          | ❌ Not built                 |
| **Search the catalog**     | ❌ **Not built — see below** |
| **Bulk operations**        | ❌ Not built                 |
| **Duplicate a product**    | ❌ Not built                 |

> **⚠ Worth being precise about search.** There is an endpoint mounted at `/v2/product-search`, and it is easy to assume it searches the catalog. **It does not.** It queries every connected supplier's API live and returns _their_ results, so staff can find things to import. There is no endpoint anywhere that searches the platform's own products.

## Customer Interaction

Customers interact with products more than any other model — viewing, filtering, comparing, adding to cart, reviewing.

**In practice today**, a shopper reaching a product page sees a title, a description, and one supplier-hosted thumbnail. There are no additional images, no size or colour options, no price on the variant, and no "add to cart" that can work, because there is no variant to add.

The catalog is browsable but not shoppable.

## Backend Usage

| Mechanism                 | How It Is Involved                                                                               |
| ------------------------- | ------------------------------------------------------------------------------------------------ |
| **Import endpoint**       | Creates products from supplier data, inside a transaction with the supplier record.              |
| **Sync worker**           | Updates supplier-side data and attempts to update variant stock — on variants that do not exist. |
| **Storefront strategies** | Eight different ways of selecting products for homepage rows. Only two filter correctly.         |
| **Analytics rollups**     | Sales are keyed by product.                                                                      |
| **Collections and CMS**   | Read products for curated displays.                                                              |
| **Caching**               | Supplier _search_ results are cached for 10 minutes. Products themselves are not cached.         |

## Business Rules

| #   | Rule                                                   | Enforced?                                        |
| --- | ------------------------------------------------------ | ------------------------------------------------ |
| 1   | Slug unique within a storefront                        | ✅ Database                                      |
| 2   | Category must be in the same storefront                | ✅ Database                                      |
| 3   | Pricing rule must be in the same storefront            | ✅ Database                                      |
| 4   | Tax class must be in the same storefront               | ✅ Database                                      |
| 5   | Only published products shown to shoppers              | ⚠ **Only 2 of 8 display strategies check**       |
| 6   | Deleted products must never be shown                   | ⚠ **Only 2 of 8 check**                          |
| 7   | Visibility must be respected                           | ❌ **Never read anywhere**                       |
| 8   | A product should not be published without images       | ❌ Not checked — and images cannot be added      |
| 9   | A product should not be published without a price      | ❌ Not checked                                   |
| 10  | Products with orders must never be hard-deleted        | ✅ Database blocks it                            |
| 11  | Imported products should be reviewed before going live | ❌ Import publishes immediately                  |
| 12  | Slug generation must not allow collisions              | ❌ Truncation can collide and silently overwrite |

**Rules 5, 6, and 7 together are the most serious issue in this part.** The schema provides three independent mechanisms for controlling what shoppers see — status, deletion, and visibility — and the display layer honours roughly a quarter of them.

## Example Scenario

**Importing a supplier's catalog.**

Danilo connects a dropshipping supplier and imports a running shoe. The import pulls the title, description, and image URL, builds the slug `urban-air-max-runner-2026`, creates the product with status `PUBLISHED`, and stores the supplier's cost price on the linked supplier record.

**The product is immediately live on the storefront.** Nobody reviewed the supplier's description, which contains three spelling errors and a reference to a competitor's brand.

A shopper finds it in the "New Arrivals" row and opens the page. She sees the title, the description, and one image loaded from the supplier's own server. There are no size options, no colour options, and no price — because no variants exist. She cannot buy it.

Danilo wants to fix the description, set a price, and add sizes. **There is no endpoint for any of that.** The only thing he can do is re-import, which would restore the same supplier text.

Two weeks later the supplier removes the product image from their server. The product page now shows a broken image, because the thumbnail points at their host rather than the platform's own storage.

_Every part of this scenario follows from the gaps listed at the top of Part 3._

## Summary

`CatalogProduct` is a well-designed model with a genuinely thorough set of fields — a four-stage lifecycle, four visibility levels, three price points, structured discounts, search text, soft deletion, and authorship tracking.

Almost none of it is exercised. Products can only arrive by supplier import, which publishes them instantly with no review, no price, no variants, and no images. There is no way to create, edit, publish, or archive a product through the API, and no way to search the catalog.

The most pressing issue is not the missing endpoints, though — it is that **six of the eight storefront display strategies ignore status and deletion, and nothing anywhere reads visibility.** That means the controls staff would use to hide a product largely do not work. Fixing the display filters is a small change and worth doing before the management endpoints, because it is a correctness problem rather than a missing feature.

---

---

# CatalogProductVariant

## Overview

A `CatalogProductVariant` is **the thing a customer actually buys**.

"Urban Air Max Runner 2026" is a product. "Urban Air Max Runner 2026, size 42, black" is a variant. The product is what you browse; the variant is what goes in the basket, what has a price, and what has stock.

**Its role in the platform:** it is the unit of commerce. Carts hold variants. Order lines reference variants. Stock is counted per variant. Nothing can be sold without one.

> **⚠ No code anywhere creates a variant.** Two places _update_ variants — the stock sync and the size-guide linking — but both assume one already exists. Since import does not create them and there is no product management API, **every product in the catalog currently has zero variants.**

## Purpose

**The business problem it solves:** a shoe in six sizes and three colours is one thing to browse and eighteen things to sell. Each of those eighteen has its own stock level, and often its own price and barcode.

**Why it is necessary:**

1. **Independent stock.** Size 42 selling out must not hide sizes 39–45.
2. **Independent pricing.** A large size may cost more.
3. **Warehouse identity.** Pickers need a specific SKU, not "a shoe".
4. **Accurate carts.** An order must record exactly which one was bought.

## Where It Is Used

| Area                     | How It Is Used                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------ |
| **Shopping Cart**        | Cart lines reference a variant, never a product.                                     |
| **Checkout**             | Order lines reference a variant, and snapshot its details.                           |
| **Inventory**            | Stock is counted per variant per location.                                           |
| **Customer Storefront**  | The size and colour selector on a product page.                                      |
| **Supplier Integration** | Supplier variants map to catalog variants; the sync updates stock through this link. |
| **Wishlists**            | Shoppers save a specific variant.                                                    |
| **Size guides**          | A variant can point at a row in a size chart.                                        |
| **Attributes**           | Structured colour and size values attach here.                                       |
| **Analytics**            | Sales roll up from variants to products.                                             |

## Who Uses It

| Actor                      | What They Do With It                                          |
| -------------------------- | ------------------------------------------------------------- |
| **Customer**               | Picks a size and colour; adds to cart; saves to wishlist.     |
| **Guest**                  | Same.                                                         |
| **Admin**                  | ⚠ Should create and manage variants. No endpoint exists.      |
| **Warehouse Staff**        | Pick and pack by SKU; stock counts are per variant.           |
| **System Background Jobs** | The sync worker updates stock levels.                         |
| **Supplier**               | Indirectly — their variants map to these.                     |
| **API**                    | Serves options to the product page; validates cart additions. |

## When Is It Created

⚠ **Never, by any code path.**

As designed, variants would be created when an admin adds options to a product, or when a supplier import brings through the supplier's variant list. Neither exists. The import creates a product and a supplier product, and stops.

## When Is It Updated

Two real paths exist, both assuming the variant already exists:

| Trigger                     | What Changes                                                        |
| --------------------------- | ------------------------------------------------------------------- |
| **Supplier stock sync**     | `stock` — the worker pulls the supplier's stock level and writes it |
| **Linking to a size chart** | `sizeEntryId`                                                       |

Everything else — price, SKU, title, attributes — has no update path.

## When Is It Deleted

**Designed for soft deletion** via `deletedAt`. Nothing sets it.

Soft deletion is correct here: order lines reference variants permanently, and the database blocks hard-deleting a variant that has ever been ordered. A discontinued size must stop being sellable without erasing the record of past sales.

## Complete Workflow

**As designed:**

```
 1. Product created
 2. Admin adds variants — one per size/colour combination
 3. Each gets a SKU, a price, and a starting stock level
 4. Supplier variants mapped to catalog variants
 5. Product published
 6. Shopper picks size 42 black on the product page
 7. That variant is added to the cart
 8. Checkout creates an order line referencing it
 9. Stock decreases                        ⚠ not implemented at checkout
10. Supplier sync keeps stock current
11. Size discontinued → variant soft-deleted
12. Past orders still reference it correctly
```

**Today:** steps 2 onward never happen.

## Features

| Feature                 | Explanation                                                                                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Per-variant stock**   | Each size and colour tracks its own quantity.                                                                                                          |
| **Per-variant pricing** | Five separate price fields — see below.                                                                                                                |
| **Optimistic locking**  | A `version` counter that increments on change, so two simultaneous stock updates cannot silently overwrite each other. A genuinely good design detail. |
| **SKU**                 | Unique within a storefront, and optional — not every business uses them.                                                                               |
| **Flexible attributes** | Colour, size, and material as a free-form structure, alongside the more rigid attribute tables.                                                        |
| **Size chart link**     | Points at a specific row in a size guide.                                                                                                              |
| **Own pricing rule**    | Can override the product's markup rule.                                                                                                                |
| **Soft deletion**       | Discontinue without erasing history.                                                                                                                   |

### The five price fields

This is the most confusing part of the model, and worth stating plainly:

| Field             | Meaning                                                  |
| ----------------- | -------------------------------------------------------- |
| `price`           | What the customer is charged. **The only required one.** |
| `compareAtPrice`  | The crossed-out "was" price.                             |
| `baseCost`        | What the supplier charges the business.                  |
| `sellingPrice`    | A manually configured selling price.                     |
| `calculatedPrice` | The price a markup rule produced from the cost.          |

Three of these — `price`, `sellingPrice`, `calculatedPrice` — could each plausibly be "the price". **Nothing in the schema or the code documents which one wins.** That ambiguity is the single biggest maintainability risk in the catalog, and it will produce a pricing bug eventually unless the precedence is written down and enforced in one place.

## Relationships

### Belongs To

| Relationship                                         | Why It Exists                                                                                      |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **A variant belongs to one `Tenant`**                | Storefront separation.                                                                             |
| **A variant belongs to one `CatalogProduct`**        | It is one option of that product. **The database enforces the product is in the same storefront.** |
| **A variant may belong to one `CatalogSizeEntry`**   | Links "size 42" to the row in the size chart giving its measurements.                              |
| **A variant may belong to one `CatalogPricingRule`** | Lets one variant use a different markup from the rest of the product.                              |

### Has Many

| Relationship                        | Why It Exists                                                                                |
| ----------------------------------- | -------------------------------------------------------------------------------------------- |
| **Many `SupplierVariant`s**         | The same size can be available from several suppliers.                                       |
| **Many `CommerceCartItem`s**        | Shoppers put this exact variant in their basket.                                             |
| **Many `CommerceOrderItem`s**       | Purchase records. **Blocks hard deletion** — a variant that has been sold cannot be removed. |
| **Many `CatalogProductMedia`**      | Colour-specific photographs.                                                                 |
| **Many `InventoryStock` rows**      | Stock per warehouse. Same-storefront enforced.                                               |
| **Many `InventoryTransaction`s**    | The history of stock movements.                                                              |
| **Many `WishlistItem`s**            | Saved by shoppers.                                                                           |
| **Many `CatalogVariantAttribute`s** | Structured colour and size values.                                                           |
| **Many `CatalogCollectionItem`s**   | Specific variants featured in curated sets.                                                  |

## Important Fields

### `price`

- **What it stores:** the amount charged for this variant.
- **Why it exists:** the actual transaction price.
- **Who updates it:** should be admins or the pricing engine.
- **When it changes:** never, currently.
- **Example value:** `4999.0000`
- **Business impact:** **the only required price field.** Four decimal places, following the platform money standard. This is what checkout copies onto the cart line.

### `stock`

- **What it stores:** quantity available.
- **Why it exists:** prevents overselling.
- **Who updates it:** the supplier sync worker.
- **When it changes:** on each sync run.
- **Example value:** `42`
- **Business impact:** **⚠ this is one of three places stock is tracked.** There is also `InventoryStock` (per warehouse, with reserved and available counts) and the supplier's own figure. Nothing reconciles them, and checkout does not decrease any of them. Which one is authoritative is undefined.

### `version`

- **What it stores:** a counter incremented on every change.
- **Why it exists:** to stop two simultaneous updates overwriting each other.
- **Who updates it:** any update that uses optimistic locking.
- **When it changes:** on concurrent-safe writes.
- **Example value:** `1`
- **Business impact:** a genuinely good design choice. When two orders for the last item arrive at once, this is what allows one to succeed and the other to be rejected rather than both succeeding.

### `sku`

- **What it stores:** the warehouse identifier.
- **Why it exists:** pickers and stock systems work in SKUs.
- **Who updates it:** should be admins.
- **When it changes:** never.
- **Example value:** `UAMR-2026-42-BLK`
- **Business impact:** unique within a storefront **when set**. Because it is optional, several variants can have no SKU without conflicting — which is the correct behaviour for businesses that do not use them.

### `attributes`

- **What it stores:** the variant's defining options as a flexible structure.
- **Why it exists:** a quick way to say "red, extra large" without joining to the attribute tables.
- **Who updates it:** should be admins.
- **When it changes:** never.
- **Example value:** `{ "color": "Black", "size": "42" }`
- **Business impact:** duplicates what `CatalogVariantAttribute` stores in structured form. Convenient for display, but two sources of the same truth that can disagree.

### `deletedAt`

- **What it stores:** when the variant was discontinued.
- **Why it exists:** stop selling without erasing sales history.
- **Who updates it:** nothing.
- **When it changes:** never.
- **Example value:** `null`
- **Business impact:** essential once variants exist, since order lines reference them permanently.

## Admin Capabilities

Every capability below is **not built**: create, edit, set price, set SKU, adjust stock, bulk-generate variants from size and colour combinations, discontinue, reorder options.

The only working writes are the automated stock sync and the size-chart link.

## Customer Interaction

**In principle** the most important interaction in the whole catalog — picking a size and colour is what turns browsing into buying.

**In practice** there is nothing to pick. Product pages have no options because no variants exist, and the "add to cart" flow has nothing to reference.

## Backend Usage

| Mechanism                   | How It Is Involved                                            |
| --------------------------- | ------------------------------------------------------------- |
| **Stock sync worker**       | Updates stock from supplier data.                             |
| **Size guide linking**      | Connects a variant to a size chart row.                       |
| **Cart and order services** | Read variants when adding to cart and creating order lines.   |
| **Inventory service**       | Optimistic locking is available here.                         |
| **Storefront**              | Read as `variants[0]` for product cards — always empty today. |

## Business Rules

| #   | Rule                                                    | Enforced?                                                     |
| --- | ------------------------------------------------------- | ------------------------------------------------------------- |
| 1   | SKU unique within a storefront when set                 | ✅ Database                                                   |
| 2   | Variant must belong to a product in the same storefront | ✅ Database                                                   |
| 3   | Stock cannot go negative                                | ⚠ The sync clamps at zero; checkout does not decrement at all |
| 4   | A sold variant cannot be hard-deleted                   | ✅ Database                                                   |
| 5   | Concurrent stock updates must not overwrite each other  | ✅ Version column supports it                                 |
| 6   | Which price field wins must be defined                  | ❌ **Undefined — five candidates, no documented precedence**  |
| 7   | Every product should have at least one variant          | ❌ Not enforced, and none exist                               |
| 8   | Checkout must decrease stock                            | ❌ Not implemented                                            |

## Example Scenario

**The shoe that cannot be sold.**

Danilo imports the running shoe. A product is created. The supplier's data includes six sizes in three colours — eighteen variants.

**None of them are created.** The import writes a product and a supplier product, and finishes.

A shopper opens the product page. She sees the shoe, the description, and one image. There is no size selector, because there are no variants. There is no price, because the price lives on the variant. The "add to cart" button has nothing to send.

Meanwhile the nightly sync worker runs. It fetches current stock from the supplier and tries to update the matching catalog variants. **It finds none to update**, so it completes successfully having done nothing. No error is raised, because updating zero rows is not a failure.

The system reports a healthy sync of a product that cannot be bought.

## Summary

`CatalogProductVariant` is the most important model in the catalog and the one furthest from working. Everything commercial depends on it — carts, orders, stock, wishlists — and nothing creates one.

The design itself is strong. Per-variant stock and pricing, optional SKUs, optimistic locking for concurrent updates, and soft deletion are all right. The one design weakness is the five price fields with no documented precedence, which will cause a pricing bug the moment real pricing is switched on.

Building variant creation is the single highest-value piece of work in the catalog. Until it exists, the platform has a catalog but not a shop.

---

---

# CatalogProductMedia

## Overview

`CatalogProductMedia` is **one photograph or video attached to a product**, with the extra information a shop needs: what order it appears in, whether it is the main image, its accessibility text, and optionally which colour it belongs to.

It is a layer on top of `AuthFile` (Part 1). The file record says "here is an image and where it lives." This model says "this image is the third photo of the black colourway, and here is its alt text."

> **⚠ No code anywhere creates a media row.** Not the import, not the sync, not any endpoint. Every product has zero media.

## Purpose

**The business problem it solves:** images sell products. Shoppers who cannot see an item from several angles do not buy it. A raw file record is not enough — a shop needs to know which image is the hero, what order the gallery runs in, and which photos belong to which colour.

**Why it is necessary:**

1. **Gallery ordering.** The hero image must be first.
2. **Colour-specific photos.** Selecting "black" should switch the gallery.
3. **Accessibility and search.** Alt text serves screen readers and image search.
4. **Video support.** Not just photographs.

## Where It Is Used

| Area                    | How It Is Used                                                                    |
| ----------------------- | --------------------------------------------------------------------------------- |
| **Customer Storefront** | Product galleries and listing thumbnails. Read as "the primary image" throughout. |
| **Collections & CMS**   | Curated displays pull the primary image for each product.                         |
| **Storefront sections** | Homepage rows show product images.                                                |
| **Marketing**           | Product photos can be reused as ad creatives.                                     |
| **Admin Dashboard**     | ⚠ Should be where images are managed. Not built.                                  |

## Who Uses It

| Actor                      | What They Do With It                                         |
| -------------------------- | ------------------------------------------------------------ |
| **Customer / Guest**       | Views images. The most-consumed data on the site.            |
| **Admin / Seller**         | ⚠ Should upload and arrange. Not built.                      |
| **System Background Jobs** | ⚠ Import should create these from supplier images. Does not. |
| **API**                    | Serves galleries.                                            |

## When Is It Created

⚠ **Never.**

As designed, media rows would be created when an admin uploads product photos, or when an import copies a supplier's images across. Neither happens. The import stores a single supplier image address directly on the product instead — a shortcut that avoids this model entirely.

## When Is It Updated

No update path exists. As designed: reordering the gallery, changing which image is primary, editing alt text.

## When Is It Deleted

**Hard deleted** — the model has no soft-delete field, and this is correct.

A media row is _owned_ by its product. If the product is deleted, its media rows go with it, because a gallery entry for a product that no longer exists is meaningless.

This is different from the _file_ it points at. Deleting a media row does not delete the underlying file, and deleting a file does not delete the media row — it just clears the link. That distinction (ownership versus reference) is explained fully in Part 1.

## Complete Workflow

```
 1. Admin uploads photographs                    ⚠ upload does not register files
 2. A media row is created per image             ⚠ never happens
 3. Position set for gallery order
 4. One image marked primary
 5. Alt text written
 6. Colour-specific images linked to variants
 7. Storefront renders the gallery
 8. Listing grids use the primary image
 9. Shopper switches colour → gallery filters
10. Product deleted → media rows deleted with it
```

## Features

| Feature                     | Explanation                                                         |
| --------------------------- | ------------------------------------------------------------------- |
| **Gallery ordering**        | A position number controls display order.                           |
| **Primary image flag**      | Marks the hero shot used in listings.                               |
| **Variant-specific images** | An image can belong to one colour rather than the whole product.    |
| **Multiple media types**    | Image, animation, video, audio, document, archive.                  |
| **Alt text**                | Accessibility and image search.                                     |
| **Optional file link**      | Can point at a platform file, or hold an external address directly. |

## Relationships

### Belongs To

| Relationship                                  | Why It Exists                                                                                                                                                                                      |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Belongs to one `CatalogProduct`**           | Media exists to show a product. **If the product is deleted, its media goes too** — correct, because it is owned, not merely referenced.                                                           |
| **May belong to one `CatalogProductVariant`** | Lets the black photos be distinct from the white ones. Optional, because most images show the product generally. If the variant is deleted the link is cleared, but the image survives.            |
| **May belong to one `AuthFile`**              | The actual stored file. Optional, because the address can be held directly — which is how supplier images would work. If the file is deleted, the link clears rather than the media row vanishing. |

### Has Many / Many-to-Many

None. This is a leaf model.

## Important Fields

### `url`

- **What it stores:** where the image can be fetched.
- **Why it exists:** the image itself.
- **Who updates it:** should be the upload or import flow.
- **When it changes:** rarely.
- **Example value:** `https://cdn.example.com/products/uamr-2026-black-1.jpg`
- **Business impact:** **required**, unlike the optional file link — so a media row always resolves to something even when it points at an external address.

### `isPrimary`

- **What it stores:** whether this is the hero image.
- **Why it exists:** listing grids need one image, not twelve.
- **Who updates it:** should be admins.
- **When it changes:** when the hero shot is changed.
- **Example value:** `true`
- **Business impact:** **⚠ nothing enforces that only one image per product is primary.** Every read across the codebase asks for "the primary image, take one" — so if two were marked primary, which one appears would be arbitrary and could change between page loads.

### `position`

- **What it stores:** gallery order.
- **Why it exists:** the sequence is a merchandising decision.
- **Who updates it:** should be admins.
- **When it changes:** on reorder.
- **Example value:** `0`
- **Business impact:** ⚠ nothing prevents duplicate positions, which would make gallery order non-deterministic.

### `altText`

- **What it stores:** a text description of the image.
- **Why it exists:** screen readers, and image search.
- **Who updates it:** should be admins.
- **When it changes:** rarely.
- **Example value:** `Black running shoe, side view`
- **Business impact:** accessibility compliance and search traffic. Frequently neglected; worth prompting for in any admin interface.

### `productVariantId`

- **What it stores:** which colour or size this image shows, if any.
- **Why it exists:** colour-specific galleries.
- **Who updates it:** should be admins.
- **When it changes:** when images are reorganised.
- **Example value:** `null` for general shots
- **Business impact:** enables the standard "click a colour swatch, gallery changes" behaviour.

## Admin Capabilities

All not built: upload images, reorder, set primary, edit alt text, assign to a variant, delete, bulk upload.

## Customer Interaction

Customers consume this model more heavily than any other — every product image on every page.

Image quality and loading speed are among the strongest influences on whether someone buys. **Today there are no media rows at all**, so product pages show only the single supplier thumbnail stored on the product, loaded from the supplier's own server.

## Backend Usage

| Mechanism               | How It Is Involved                                            |
| ----------------------- | ------------------------------------------------------------- |
| **Storefront queries**  | Nearly every product read includes "primary image, take one". |
| **Collections and CMS** | Same pattern for curated displays.                            |
| **Import**              | ⚠ Should create these from supplier images. Does not.         |
| **Image processing**    | Should generate thumbnails and modern formats. Not built.     |

## Business Rules

| #   | Rule                                                  | Enforced?       |
| --- | ----------------------------------------------------- | --------------- |
| 1   | Media is deleted with its product                     | ✅ Database     |
| 2   | Deleting a file clears the link, not the media row    | ✅ Database     |
| 3   | Deleting a variant clears the link, not the media row | ✅ Database     |
| 4   | Only one image per product may be primary             | ❌ Not enforced |
| 5   | Positions should be unique within a product           | ❌ Not enforced |
| 6   | Every product should have at least one image          | ❌ Not enforced |
| 7   | Alt text should be required for accessibility         | ❌ Optional     |

## Example Scenario

**The gallery that never was.**

The supplier's data for the running shoe includes eight photographs — three general shots and colour-specific images for black, white, and red.

The import ignores all of them except one, whose address it copies onto the product as a thumbnail. **No media rows are created.**

The product page renders a gallery component that asks for the product's primary image. It gets nothing. The page falls back to the thumbnail — a single image, loaded from the supplier's server.

A shopper wanting to see the shoe from behind cannot. She leaves.

Three weeks later the supplier reorganises their storage and the image address stops working. The product page now shows a broken image. Had the image been copied into the platform's own storage and registered as a media row, this could not have happened.

## Summary

`CatalogProductMedia` is a well-judged model that sits correctly between the raw file registry and the product. The ownership rules are exactly right: media is deleted with its product, but merely unlinked when a file or variant goes away.

It is entirely unused. No code creates a media row, so no product has a gallery. The import sidesteps the model by copying one supplier image address onto the product — which works, barely, until the supplier moves their files.

Two small rules should be added when it is wired up: only one primary image per product, and unique positions within a gallery. Neither can be expressed in the schema directly; both need a database-level rule.

---

---

# CatalogSizeGuide

## Overview

A `CatalogSizeGuide` is **a size chart attached to a product** — the table a shopper opens when they are unsure whether to order a 42 or a 43.

It is deliberately general. Despite the name, it works for any kind of measurement table:

- **Clothing:** chest, waist, hips, inseam
- **Footwear:** foot length mapped to US, EU, and UK sizes
- **Electronics:** screen size and dimensions
- **Furniture:** width, height, depth

The guide is the chart itself — its title, its help text, and its units. The individual rows are `CatalogSizeEntry`, covered next.

## Purpose

**The business problem it solves:** wrong-size returns. In fashion, sizing is the single largest cause of returns, and every return costs shipping both ways plus handling. A clear size chart is one of the cheapest ways to reduce that.

**Why it is necessary:**

1. **Fewer returns.** Directly reduces cost.
2. **Higher conversion.** Shoppers unsure of size often do not buy at all.
3. **International selling.** US 9, EU 42, and UK 8 are the same shoe.
4. **Cross-category use.** One mechanism serves clothing, footwear, and furniture.

## Where It Is Used

| Area                    | How It Is Used                                           |
| ----------------------- | -------------------------------------------------------- |
| **Customer Storefront** | The "size guide" link on a product page.                 |
| **Admin Dashboard**     | Staff build and maintain charts.                         |
| **Catalog**             | Attached per product.                                    |
| **Returns**             | Reducing size-related returns is the main business case. |
| **Mobile App**          | Same chart, rendered for a small screen.                 |

## Who Uses It

| Actor                                            | What They Do With It                                                         |
| ------------------------------------------------ | ---------------------------------------------------------------------------- |
| **Customer / Guest**                             | Opens the chart before choosing a size.                                      |
| **Admin**                                        | Creates and edits charts. ✅ **This actually works** — full endpoints exist. |
| **Seller**                                       | ❌ Not permitted — admin roles only.                                         |
| **API**                                          | Serves charts to product pages.                                              |
| **Warehouse Staff / Supplier / Payment Gateway** | No involvement.                                                              |

## When Is It Created

An admin creates one via `POST /v2/size-guides`, giving it a product, a label, optional help text, and a unit.

**This is one of the few catalog models with a complete, working management API** — create, update, delete, plus separate endpoints for managing the rows within a chart.

## When Is It Updated

| Trigger                           | What Changes                        |
| --------------------------------- | ----------------------------------- |
| Renaming the chart                | `label`                             |
| Editing the help text             | `description`                       |
| Switching measurement units       | `unit`                              |
| Adding, editing, or removing rows | Handled through the entry endpoints |

## When Is It Deleted

**Hard deleted**, and correctly so.

A size guide is _owned_ by its product — deleting the product deletes its charts, because a size chart for a product that no longer exists has no meaning. It is reference data, not a transaction record, so there is nothing to preserve.

Its rows are deleted with it, for the same reason.

One consequence worth knowing: variants can point at a size chart row. If a chart is deleted, those variants have their link cleared rather than being deleted themselves — the variant survives, it just no longer has measurements attached.

## Complete Workflow

```
 1. Admin creates a chart for the running shoe
 2. Labels it "EU / US Shoe Sizing", unit "CM"
 3. Adds a row per size — 39 through 45
 4. Each row gets a label and a foot length
 5. Rows ordered by position
 6. Variants linked to their matching row
 7. Shopper opens the product page
 8. Clicks "Size Guide" → chart appears
 9. Compares her foot length, picks 42
10. Buys the right size; no return
11. Product discontinued → chart deleted with it
```

## Features

| Feature                         | Explanation                                                                        |
| ------------------------------- | ---------------------------------------------------------------------------------- |
| **Multiple charts per product** | A garment can carry both a body-measurement chart and a garment-measurement chart. |
| **Flexible units**              | Centimetres, millimetres, inches, or regional sizing systems.                      |
| **Optional help text**          | Guidance shown beneath the chart, such as how to measure.                          |
| **Category-agnostic**           | Works for clothing, shoes, electronics, and furniture without change.              |
| **Ordered rows**                | Charts display in a sensible sequence rather than arbitrarily.                     |
| **Variant linking**             | A specific size option can point at its chart row.                                 |

## Relationships

### Belongs To

| Relationship                        | Why It Exists                                                                                                                           |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Belongs to one `CatalogProduct`** | Sizing is product-specific — two brands' size 42 differ. **Deleting the product deletes its charts**, correct for owned reference data. |

### Has Many

| Relationship                     | Why It Exists                                                                          |
| -------------------------------- | -------------------------------------------------------------------------------------- |
| **Many `CatalogSizeEntry` rows** | The chart is the container; entries are the rows. Deleting the chart deletes its rows. |

### Note on storefront scoping

`CatalogSizeGuide` carries **no storefront column**. It does not need one — it reaches its storefront through its product. This is correct normalisation, and the same reasoning applies to `CatalogSizeEntry`.

## Important Fields

### `label`

- **What it stores:** the chart's title.
- **Why it exists:** a product with two charts needs them distinguished.
- **Who updates it:** admins.
- **When it changes:** rarely.
- **Example value:** `International Size Chart`
- **Business impact:** shown as the chart heading.

### `unit`

- **What it stores:** the measurement system.
- **Why it exists:** 42 centimetres and 42 inches are very different.
- **Who updates it:** admins.
- **When it changes:** rarely.
- **Example value:** `CM`
- **Business impact:** ⚠ stored as free text with a default of `CM`, not a fixed list. Nothing prevents a typo like `cm ` or `Centimeters`, which the storefront would display verbatim.

### `description`

- **What it stores:** guidance shown beneath the chart.
- **Why it exists:** a chart is only useful if shoppers measure correctly.
- **Who updates it:** admins.
- **When it changes:** rarely.
- **Example value:** `Measure around the fullest part of your chest, keeping the tape level.`
- **Business impact:** genuinely reduces returns. Often the difference between a chart that helps and one that confuses.

## Admin Capabilities

| Capability                          | Available Today                     |
| ----------------------------------- | ----------------------------------- |
| **Create a chart**                  | ✅                                  |
| **View a product's charts**         | ✅                                  |
| **View one chart**                  | ✅                                  |
| **Edit**                            | ✅                                  |
| **Delete**                          | ✅                                  |
| **Add / edit / remove rows**        | ✅                                  |
| **Link a variant to a row**         | ✅                                  |
| **Copy a chart to another product** | ❌ Not built — would save real time |
| **Reusable chart templates**        | ❌ Not built                        |

**This is the most complete admin surface in the catalog** — which is a slightly odd outcome, given that products themselves have none.

## Customer Interaction

Shoppers open the size guide at the moment of highest hesitation — deciding whether to buy. A clear chart converts; a missing one loses the sale or produces a return.

They only ever read it. Both the by-product and by-ID lookups are public, correctly, since size information must be available before login.

## Backend Usage

| Mechanism                      | How It Is Involved                                                 |
| ------------------------------ | ------------------------------------------------------------------ |
| **APIs**                       | Two public reads, full admin management, plus row-level endpoints. |
| **Variant linking**            | A dedicated call attaches a variant to a chart row.                |
| **Caching**                    | ⚠ Not cached, though charts change very rarely and are read often. |
| **Background jobs / Webhooks** | No involvement.                                                    |

## Business Rules

| #   | Rule                                                                | Enforced?                        |
| --- | ------------------------------------------------------------------- | -------------------------------- |
| 1   | A chart must belong to a product                                    | ✅ Required                      |
| 2   | Deleting a product deletes its charts                               | ✅ Database                      |
| 3   | Deleting a chart deletes its rows                                   | ✅ Database                      |
| 4   | Deleting a chart clears variant links rather than deleting variants | ✅ Database                      |
| 5   | Units should come from a fixed list                                 | ❌ Free text                     |
| 6   | Only admins may manage charts                                       | ✅                               |
| 7   | Reads are public                                                    | ✅ Correct — needed before login |

## Example Scenario

**Cutting returns on a shoe.**

The running shoe is returned constantly — shoppers order their usual size and find it runs small.

Danilo creates a chart labelled "EU / US Shoe Sizing" in centimetres, with help text explaining how to measure foot length. He adds seven rows, 39 through 45, each with its foot length and US and UK equivalents. He links each variant to its row.

A shopper who normally wears a 42 opens the chart, measures her foot at 26.5 cm, and sees that corresponds to a 43 in this brand. She orders a 43.

**No return.** The chart cost twenty minutes to build and saves two-way shipping on every avoided return.

## Summary

`CatalogSizeGuide` is the best-implemented model in Part 3. It has complete admin endpoints, public reads, correct ownership semantics, and a deliberately general design that serves clothing, footwear, and furniture equally well.

Its only rough edge is that units are free text rather than a fixed list. Its only missing feature is chart templates — building the same chart for fifty products is tedious.

It is also a good argument for the rest of the catalog: this is what a finished catalog model looks like.

---

---

# CatalogSizeEntry

## Overview

A `CatalogSizeEntry` is **one row in a size chart** — the line that says "Size M: chest 96 cm, waist 81 cm."

Each entry has a label ("M", "42", "EU 38"), a position in the chart, and a set of measurement columns. Every measurement is optional, and the intent is that you fill in only the ones that apply.

## Purpose

**The business problem it solves:** measurements need to be comparable, not free text. Storing "chest about 96 centimetres" as a sentence makes it impossible to sort a chart, convert units, or later build a size recommender. Storing it as a number in a chest column makes all of that possible.

**Why it is necessary:**

1. **Structure.** Numbers, not prose.
2. **One shape for many categories.** Clothing, footwear, and furniture share one table.
3. **Variant linking.** A specific size option points at exactly one row.
4. **Future recommendations.** "Based on your last order, you are a 43" needs structured data.

## Where It Is Used

| Area                    | How It Is Used                                                       |
| ----------------------- | -------------------------------------------------------------------- |
| **Customer Storefront** | The rows of the size chart on a product page.                        |
| **Admin Dashboard**     | Staff enter measurements row by row.                                 |
| **Catalog**             | Variants link to the row matching their size.                        |
| **Returns**             | The business case — accurate measurements reduce wrong-size returns. |

## Who Uses It

| Actor                | What They Do With It                                |
| -------------------- | --------------------------------------------------- |
| **Customer / Guest** | Reads measurements to choose a size.                |
| **Admin**            | Creates and edits rows. ✅ Working endpoints exist. |
| **API**              | Serves rows as part of a chart.                     |
| **Everyone else**    | No involvement.                                     |

## When Is It Created

An admin adds a row to an existing chart. Rows cannot exist without a chart to sit in.

## When Is It Updated

| Trigger                  | What Changes           |
| ------------------------ | ---------------------- |
| Correcting a measurement | Any measurement column |
| Renaming a size          | `sizeLabel`            |
| Reordering the chart     | `position`             |

## When Is It Deleted

**Hard deleted.** A row is owned by its chart; deleting the chart deletes its rows, and rows can be removed individually.

If a variant is linked to a row that gets deleted, the variant's link is cleared — the variant survives without measurements rather than being deleted. That is the right behaviour: a size that exists but has no chart entry is still sellable.

## Complete Workflow

```
1. Chart created for a garment
2. Admin adds a row labelled "M"
3. Fills chest 96, waist 81, hips 101 — leaves footwear and
   furniture columns empty, since they do not apply
4. Sets position so M sits between S and L
5. Repeats for every size
6. Links the "M" variant to this row
7. Shopper opens the chart, compares, chooses M
8. Later a measurement is found wrong and corrected in place
9. Chart deleted → rows deleted; variant links cleared
```

## Features

| Feature                          | Explanation                                                                                                           |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Fourteen measurement columns** | Covers apparel, footwear, and dimensional goods in one table.                                                         |
| **All measurements optional**    | Fill in only what applies. A shoe row uses foot length; a sofa row uses width, height, and depth.                     |
| **Free-text size label**         | "XS", "42", "EU 38", "King" — whatever suits the category.                                                            |
| **Explicit ordering**            | Sizes sort by position, not alphabetically. Essential, since alphabetical order would put L before M and S before XL. |
| **Per-row weight**               | Weight can vary by size, with its own unit.                                                                           |
| **Variant linking**              | Several variants can point at the same row.                                                                           |

### The measurement columns

| Group           | Columns                 | Typical Use                      |
| --------------- | ----------------------- | -------------------------------- |
| Upper body      | chest, shoulder, sleeve | Shirts, jackets                  |
| Lower body      | waist, hips, inseam     | Trousers, skirts                 |
| General garment | length                  | Dresses, coats                   |
| Footwear        | footLength              | Shoes                            |
| Dimensional     | width, height, depth    | Furniture, appliances            |
| Electronics     | screenSize              | Monitors, phones                 |
| Weight          | weight, weightUnit      | Anything where it varies by size |

This is a deliberate design trade-off. A furniture row leaves ten columns empty, which looks wasteful — but empty columns cost almost nothing, and the alternative (a separate table per category, or free-form key–value pairs) would be far harder to query and display.

## Relationships

### Belongs To

| Relationship                          | Why It Exists                                                                |
| ------------------------------------- | ---------------------------------------------------------------------------- |
| **Belongs to one `CatalogSizeGuide`** | A row has no meaning outside its chart. Deleting the chart deletes its rows. |

### Has Many

| Relationship                      | Why It Exists                                                                                                                                                    |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Many `CatalogProductVariant`s** | Several variants can share one row — the "M" row serves M in black, M in white, and M in red. This is why the relationship runs this way rather than one-to-one. |

## Important Fields

### `sizeLabel`

- **What it stores:** the size's display name.
- **Why it exists:** what the shopper actually sees and selects.
- **Who updates it:** admins.
- **When it changes:** rarely.
- **Example value:** `M`
- **Business impact:** free text by design, because sizing conventions vary wildly by category and region.

### `position`

- **What it stores:** the row's place in the chart.
- **Why it exists:** sizes have a natural order that sorting cannot infer.
- **Who updates it:** admins.
- **When it changes:** on reorder.
- **Example value:** `2`
- **Business impact:** **more important than it looks.** Without it, an alphabetical chart would read L, M, S, XL — which is confusing enough to undermine the chart's purpose.

### Measurement columns

- **What they store:** numeric measurements, to two decimal places.
- **Why they exist:** structured, comparable values rather than prose.
- **Who updates them:** admins.
- **When they change:** on correction.
- **Example value:** `96.00`
- **Business impact:** all optional. Note these are **not** money columns and correctly kept at two decimal places, unlike prices which use four.

### `weightUnit`

- **What it stores:** the unit for the weight column.
- **Why it exists:** kilograms and pounds are not interchangeable.
- **Who updates it:** admins.
- **When it changes:** rarely.
- **Example value:** `KG`
- **Business impact:** ⚠ free text, like the chart's own unit field. A fixed list would be safer.

## Admin Capabilities

| Capability                      | Available Today                                                         |
| ------------------------------- | ----------------------------------------------------------------------- |
| **Add a row**                   | ✅                                                                      |
| **Edit a row**                  | ✅                                                                      |
| **Delete a row**                | ✅                                                                      |
| **Reorder**                     | ✅ Via position                                                         |
| **Link a variant to a row**     | ✅                                                                      |
| **Bulk import rows**            | ❌ Not built — pasting from a spreadsheet would be the natural workflow |
| **Convert units automatically** | ❌ Not built                                                            |

## Customer Interaction

Customers read these rows and nothing else. Every number in a size chart is one of these fields.

The interaction is brief but decisive: a shopper comparing her measurements against a chart is at the precise moment of deciding whether to buy and in which size. Accuracy here directly determines both conversion and return rate.

## Backend Usage

| Mechanism           | How It Is Involved                                                  |
| ------------------- | ------------------------------------------------------------------- |
| **APIs**            | Served as part of a chart; managed through dedicated row endpoints. |
| **Variant linking** | A variant points at exactly one row.                                |
| **Caching**         | ⚠ Not cached, despite changing almost never.                        |
| **Background jobs** | None. A future size recommender would read these.                   |

## Business Rules

| #   | Rule                                                              | Enforced?                                                |
| --- | ----------------------------------------------------------------- | -------------------------------------------------------- |
| 1   | A row must belong to a chart                                      | ✅ Required                                              |
| 2   | Deleting a chart deletes its rows                                 | ✅ Database                                              |
| 3   | Deleting a row clears variant links rather than deleting variants | ✅ Database                                              |
| 4   | All measurements are optional                                     | ✅ By design                                             |
| 5   | Size labels should be unique within a chart                       | ❌ Not enforced — two rows could both say "M"            |
| 6   | Positions should be unique within a chart                         | ❌ Not enforced                                          |
| 7   | Measurements should be positive                                   | ❌ Not checked — a negative chest measurement would save |
| 8   | Weight units should come from a fixed list                        | ❌ Free text                                             |

## Example Scenario

**One chart, three categories.**

The platform runs three storefronts, and the same table serves all of them.

**Fashion** — a linen shirt. Rows XS through XXL, each with chest, shoulder, sleeve, and length. The footwear and furniture columns sit empty.

**Sports** — a running shoe. Rows 39 through 45, each with foot length in centimetres. Only one measurement column is used; thirteen are empty.

**Home** — a three-seat sofa. One row labelled "Standard" with width, height, depth, and weight in kilograms.

Three completely different products, three completely different measurement needs, **one table and one set of endpoints.** No schema change, no special-casing, no separate code path per category.

That generality is the model's real achievement, and it is why the empty columns are a good trade rather than a waste.

## Summary

`CatalogSizeEntry` is a small model that does its job well. The single-table design with many optional columns is a deliberate and correct trade-off — it keeps one code path serving clothing, footwear, and furniture, at the cost of some empty cells.

Together with `CatalogSizeGuide` it forms the most complete, most usable part of the catalog. Full admin endpoints, correct ownership rules, public reads, and a design that genuinely generalises.

The gaps are minor: no validation that measurements are positive, no uniqueness on size labels or positions within a chart, and free-text units where a fixed list would be safer. None of these are urgent.

---

---

# Part 3 Summary

## What the Catalog Does

```
Category        →  how shoppers browse            ✅ working
Product         →  what they look at              ⚠ import only
Variant         →  what they buy                  ❌ never created
Media           →  what they see                  ❌ never created
Size Guide      →  how they choose a size         ✅ working
Size Entry      →  the measurements               ✅ working
```

## Maturity at a Glance

| Model                   | Design | Implementation                 | Verdict                          |
| ----------------------- | ------ | ------------------------------ | -------------------------------- |
| `CatalogCategory`       | Strong | Full CRUD, proper isolation    | **Working**                      |
| `CatalogProduct`        | Strong | Import only; no management API | **Partially working**            |
| `CatalogProductVariant` | Strong | Never created                  | **Not functional**               |
| `CatalogProductMedia`   | Strong | Never created                  | **Not functional**               |
| `CatalogSizeGuide`      | Strong | Full CRUD                      | **Working — the best in Part 3** |
| `CatalogSizeEntry`      | Strong | Full CRUD                      | **Working**                      |

An unusual shape: the _supporting_ models are finished while the _central_ ones are not. A shop can define beautiful size charts for products nobody can buy.

## The Findings Worth Acting On

| #   | Finding                                                                | Why It Matters                                                                                                    |
| --- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 1   | **Six of eight storefront strategies ignore `status` and `deletedAt`** | Draft and archived products are shown to shoppers. **A correctness bug, not a missing feature — fix this first.** |
| 2   | **`visibility` is never read anywhere**                                | Products marked members-only or hidden are fully public.                                                          |
| 3   | **No variant is ever created**                                         | Nothing in the catalog can be bought.                                                                             |
| 4   | **No media row is ever created**                                       | No product has a gallery.                                                                                         |
| 5   | **No product management API**                                          | Cannot create, edit, publish, archive, or categorise a product.                                                   |
| 6   | **Import publishes immediately**                                       | Supplier titles and descriptions go live unreviewed.                                                              |
| 7   | **Slug truncation can silently overwrite**                             | Two similar long titles collapse to one slug; the upsert overwrites.                                              |
| 8   | **Five variant price fields, no documented precedence**                | A pricing bug waiting to happen.                                                                                  |
| 9   | **`product-search` searches suppliers, not the catalog**               | There is no catalog search at all.                                                                                |
| 10  | **Pricing calculations use floating-point maths**                      | Rounds to 2 decimal places while columns store 4. Same class of issue fixed earlier in order totals.              |
| 11  | **Category delete is permanent despite a soft-delete field**           | Blocked when in use, but with a raw database error rather than a clear message.                                   |
| 12  | **Nothing enforces one primary image per product**                     | Gallery hero becomes non-deterministic once media exists.                                                         |

**Item 1 deserves priority.** Items 3 through 5 are large pieces of missing functionality — real work, clearly scoped. Item 1 is a small change to six files that stops shoppers seeing things they should not, and it will silently misbehave the moment products do have proper statuses.

## Where the Design Is Genuinely Good

- **Product and variant are correctly separated.** Browse the product, buy the variant. Many platforms get this wrong.
- **Optimistic locking on variants and stock** — the right tool for concurrent stock updates.
- **Ownership versus reference is handled precisely.** Media dies with its product but merely unlinks from its file. Size rows die with their chart but merely unlink from variants. This distinction is applied consistently and correctly throughout.
- **Size guides generalise across categories** without special-casing, which is why one implementation serves clothing, footwear, and furniture.
- **Category tenant isolation is enforced by the database**, not by developers remembering a filter.
- **Category writes use tenant-filtered updates**, so the database enforces the boundary rather than trusting the caller.

The catalog's data model is sound. What it needs is the management layer that fills it — and, before that, a small fix so the display layer respects the controls that already exist.

---

**End of Part 3 — Catalog Management**

_Next: Part 4 — Supplier & Dropshipping (8 models). See the Contents table at the top of this guide for the full roadmap._
