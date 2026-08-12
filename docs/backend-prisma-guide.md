# Backend Prisma Guide (Index)

**Platform:** All-In-One V2 — Multi-Tenant Headless Commerce Platform
**Purpose:** A model-by-model explanation of the entire database schema.
*Note: This file has been refactored. The detailed lifecycle guides for each domain have been extracted into individual files under `docs/schema-guides/`.*

---

## 🏗️ Architecture Note
This project follows a strict **Domain-Driven Design (DDD)** approach. For an explanation of how the modules and layers (Controllers, Services, Repositories) interact, please see our new guide:
[**Modular Architecture & DDD**](./architecture/modular-architecture.md)

---

## 📖 Schema Lifecycle Guides

These guides walk through every model, explaining what it is, who touches it, when records are created, and how it fits into the platform end-to-end.

### 🟢 Completed Guides
* [**Part 1 — Authentication & User Management**](./schema-guides/01-auth-and-users.md) (`AuthUser`, `AuthSession`, `AuthSocialAccount`, `AuthFile`)
* [**Part 2 — Multi-Tenant Store Management**](./schema-guides/02-multi-tenant.md) (`Tenant`)
* [**Part 3 — Catalog Management**](./schema-guides/03-catalog.md) (`CatalogCategory`, `CatalogProduct`, `CatalogProductVariant`, `CatalogProductMedia`, `CatalogSizeGuide`, `CatalogSizeEntry`)
* [**Part 4 — Commerce & Orders**](./schema-guides/04-commerce-and-orders.md) 
* [**Part 5 — Suppliers**](./schema-guides/05-suppliers.md)
* [**Part 6 — Inventory**](./schema-guides/06-inventory.md)

### 🟡 Pending Domains
* CMS
* Marketing
* Customer Engagement
* Promotions
* Collections
* Attributes
* Tax
* Analytics
* Storefront
* Operations

---

## ⚙️ Architectural Specifications
If you are looking for the raw architectural specifications (indexes, API design, security controls), please look in the [`docs/schema/`](./schema/) directory.
