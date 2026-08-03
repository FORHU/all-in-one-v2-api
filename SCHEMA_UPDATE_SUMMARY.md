# Prisma Schema Update Summary & Architecture Reference

This document is the authoritative reference for the domain architecture implemented in this project. It follows **Domain-Driven Design (DDD)** with a strict separation between the Catalog, Storefront, and CMS domains.

---

## Domain Boundaries at a Glance

| Domain         | Owns                            | Answers                              |
| -------------- | ------------------------------- | ------------------------------------ |
| **Catalog**    | Products, Variants, Collections | "What products exist?"               |
| **Storefront** | Pages, Sections, Merchandising  | "What appears on HOME?"              |
| **CMS**        | Banners, Text Blocks, Media     | "What editorial content shows here?" |
| **Analytics**  | Sales stats, Rankings           | "What is trending?"                  |
| **Promotions** | Coupons, Campaigns, Discounts   | "What is on sale?"                   |

---

## 1. The Catalog Domain

The Catalog domain manages persistent, merchant-curated product data. It is never aware of presentation, algorithms, or merchandising.

### `CollectionType` Enum

Restricts collections to predefined merchant-managed structural formats.

```prisma
enum CollectionType {
  OUTFIT
  LOOKBOOK
  BUNDLE
  ROUTINE
  SETUP
  ROOM_BUNDLE
}
```

### `CatalogCollection` Model

**Purpose:** A stable, merchant-curated grouping of products (e.g., "Summer 2026 Lookbook"). Contains no dynamic display logic.

| Field         | Type             | Description                   |
| ------------- | ---------------- | ----------------------------- |
| `id`          | `String`         | Unique identifier             |
| `title`       | `String`         | Display name                  |
| `slug`        | `String`         | URL-safe identifier           |
| `type`        | `CollectionType` | Structural format             |
| `description` | `String?`        | Optional description          |
| `metadata`    | `Json?`          | Vertical-specific data        |
| `sortOrder`   | `Int`            | Position relative to siblings |
| `isPublic`    | `Boolean`        | Visibility flag               |

**Relations:**

- `parent CatalogCollection?` / `children CatalogCollection[]` — Hierarchical nesting
- `items CatalogCollectionItem[]` — Products in the collection
- `storefrontSections StorefrontSection[]` — Pass-through bridge to Storefront

### `CatalogCollectionItem` Model

**Purpose:** A specific product slot within a curated collection.

| Field        | Type      | Description                           |
| ------------ | --------- | ------------------------------------- |
| `slot`       | `String?` | Named slot (e.g., "Monitor", "Shirt") |
| `position`   | `Int`     | Order within the collection           |
| `isOptional` | `Boolean` | Whether slot is optional              |

**Relations:** `collection`, `product`, `productVariant`

---

## 2. The Storefront Domain

The Storefront domain is responsible for **page composition and dynamic merchandising**. It never owns products; it only references them. This domain answers "what appears where and how".

The data flow is:

```
StorefrontPage
  └── StorefrontSection (ordered by sortOrder)
        └── Strategy (TRENDING, COLLECTION, MANUAL...)
              └── Products (from Catalog or Analytics)
```

### `StorefrontPageType` Enum

Classifies what _type_ of page a `StorefrontPage` represents.

```prisma
enum StorefrontPageType {
  HOME       // The marketplace homepage
  CATEGORY   // A product category browse page
  PRODUCT    // A product detail page
  STORE      // A merchant's store page
  BRAND      // A brand landing page
  SEARCH     // Search results page
  CAMPAIGN   // Promotional/seasonal campaign
  CUSTOM     // Merchant-created custom landing page
}
```

### `StorefrontContextType` Enum

The polymorphic target type for context-specific sections (e.g., which category, which store).

```prisma
enum StorefrontContextType {
  CATEGORY
  STORE
  BRAND
  CAMPAIGN
}
```

### `StorefrontSectionStrategy` Enum

Defines **how** a section is populated at runtime by the Strategy Factory.

```prisma
enum StorefrontSectionStrategy {
  MANUAL       // 100% merchant-curated pinned items
  COLLECTION   // Passes through a linked CatalogCollection
  TRENDING     // Populated from analytics velocity data
  BEST_SELLERS // Populated from all-time sales totals
  NEW_ARRIVALS // Sorted by most recently published
  FLASH_SALE   // Merchant-pinned sale items
  FEATURED     // Products explicitly flagged as featured
  RECOMMENDED  // Personalised (falls back to Best Sellers)
}
```

### `StorefrontPage` Model

**Purpose:** Represents a physical page in the storefront. Multiple pages of the same `pageType` can exist (e.g., multiple CUSTOM campaign pages).

| Field            | Type                 | Description                             |
| ---------------- | -------------------- | --------------------------------------- |
| `id`             | `String`             | Unique identifier                       |
| `tenantId`       | `String`             | Multi-tenant scope                      |
| `title`          | `String`             | Human-readable name                     |
| `slug`           | `String`             | URL-safe identifier (unique per tenant) |
| `pageType`       | `StorefrontPageType` | What kind of page this is               |
| `isPublished`    | `Boolean`            | Whether page is live                    |
| `seoTitle`       | `String?`            | SEO `<title>` override                  |
| `seoDescription` | `String?`            | Meta description                        |
| `layout`         | `String?`            | Frontend layout key mapping             |

**Relations:**

- `tenant Tenant`
- `sections StorefrontSection[]` — Ordered list of sections on this page

### `StorefrontSection` Model

**Purpose:** A single merchandising block on a page. Delegates product fetching to the application-layer Strategy pattern.

| Field          | Type                        | Description                            |
| -------------- | --------------------------- | -------------------------------------- |
| `id`           | `String`                    | Unique identifier                      |
| `tenantId`     | `String`                    | Multi-tenant scope                     |
| `pageId`       | `String`                    | Which `StorefrontPage` this belongs to |
| `title`        | `String`                    | Display title (e.g., "Trending Now")   |
| `slug`         | `String`                    | Unique identifier for caching          |
| `strategy`     | `StorefrontSectionStrategy` | How products are fetched               |
| `sortOrder`    | `Int`                       | Order on the page                      |
| `maxItems`     | `Int`                       | Maximum products to display            |
| `cacheMinutes` | `Int?`                      | Redis TTL (null = no cache)            |
| `isEnabled`    | `Boolean`                   | Section visibility toggle              |
| `config`       | `Json?`                     | Strategy-specific settings             |
| `collectionId` | `String?`                   | Bridge to a CatalogCollection          |
| `contextType`  | `StorefrontContextType?`    | Polymorphic context type               |
| `contextId`    | `String?`                   | ID of the targeted context entity      |

**Relations:**

- `page StorefrontPage` — The parent page
- `collection CatalogCollection?` — Used when `strategy = COLLECTION`
- `pinnedItems StorefrontSectionItem[]` — Manually curated override products

**Polymorphic Context Usage:**

```
CATEGORY page showing shoes:
  contextType = CATEGORY
  contextId   = "shoes-category-id"

STORE page for Nike:
  contextType = STORE
  contextId   = "nike-store-id"
```

### `StorefrontSectionItem` Model

**Purpose:** A manually pinned product within a section. Used by `ManualStrategy` and as merchant-boost overrides for dynamic strategies.

| Field       | Type     | Description              |
| ----------- | -------- | ------------------------ |
| `sectionId` | `String` | Parent section           |
| `productId` | `String` | Pinned product           |
| `position`  | `Int`    | Order within the section |

---

## 3. Application Layer (CSR Architecture)

The backend is built following a strict layered architecture:

```
Controller
  └── Service (orchestration)
        └── Repository (DB access)
        └── Builder (cache + strategy dispatch)
              └── StrategyFactory (no switch statements)
                    └── Strategy.build(section, context)
                          └── Analytics / Catalog / Pinned items
```

| Layer          | File                                       | Responsibility                          |
| -------------- | ------------------------------------------ | --------------------------------------- |
| **Controller** | `storefront.controller.ts`                 | HTTP parsing, validation, response      |
| **Service**    | `storefront.service.ts`                    | Use case coordination                   |
| **Repository** | `storefront.repository.ts`                 | DB access, polymorphic section queries  |
| **Builder**    | `storefront/builder/storefront.builder.ts` | Redis caching + strategy invocation     |
| **Factory**    | `storefront/factory/strategy.factory.ts`   | Strategy registry, no switch statements |
| **Strategies** | `storefront/strategies/*.strategy.ts`      | 8 specific population algorithms        |
| **DTO**        | `storefront/dto/storefront.dto.ts`         | Stable API contract types               |
| **Mapper**     | `storefront/mapper/storefront.mapper.ts`   | Prisma entity → DTO transformation      |

### API Endpoints

| Method   | Path                                                                  | Auth   | Description                |
| -------- | --------------------------------------------------------------------- | ------ | -------------------------- |
| `GET`    | `/v2/storefront?pageType=HOME`                                        | Public | Fetch home page layout     |
| `GET`    | `/v2/storefront?slug=black-friday`                                    | Public | Fetch page by slug         |
| `GET`    | `/v2/storefront?pageType=CATEGORY&contextType=CATEGORY&contextId=abc` | Public | Category-specific layout   |
| `POST`   | `/v2/storefront/pages`                                                | Admin  | Create a storefront page   |
| `PUT`    | `/v2/storefront/pages/:id`                                            | Admin  | Update a storefront page   |
| `DELETE` | `/v2/storefront/pages/:id`                                            | Admin  | Delete a storefront page   |
| `POST`   | `/v2/storefront`                                                      | Admin  | Create a section           |
| `PUT`    | `/v2/storefront/:id`                                                  | Admin  | Update a section           |
| `DELETE` | `/v2/storefront/:id`                                                  | Admin  | Delete a section           |
| `POST`   | `/v2/storefront/:sectionId/items`                                     | Admin  | Pin a product to a section |
| `DELETE` | `/v2/storefront/:sectionId/items/:itemId`                             | Admin  | Unpin a product            |
