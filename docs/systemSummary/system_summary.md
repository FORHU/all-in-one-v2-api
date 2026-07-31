# System Architecture Summary & Structure

This document outlines the architecture, component breakdown, and directory structure of **all-in-one-v2-api** — the central backend API for the marketplace platform.

---

## Core Architecture

The platform follows a **Backend-First Centralized Marketplace Architecture** designed for high scalability, multi-tenancy, and modularity. Frontends (web & mobile apps) communicate exclusively with this API, while external supplier integrations and background worker tasks are decoupled via background queues and standardized adapter interfaces.

### Key Components

- **Express.js & TypeScript:** Core HTTP routing, controller execution, and business logic layer.
- **Prisma ORM:** Database schema definitions (`schema.prisma`), migrations, and typed database access.
- **Redis:** In-memory cache for fast product search aggregation, session storage, and rate-limiting.
- **RabbitMQ:** Asynchronous job queue handling product synchronization, background imports, and email notifications without blocking HTTP requests.
- **Supplier Adapter Pattern:** A standardized `SupplierAdapter` interface allowing seamless integration with dropshipping suppliers (CJ Dropshipping, AliExpress, Printful) while maintaining platform-agnostic business rules.

---

## Functional Modules Overview

1. **Authentication & User Management:** JWT-based authentication with refresh token rotation, user profile control, and role-based authorization (`ADMIN`, `SUPERADMIN`, `MERCHANT`, `CUSTOMER`).
2. **Product Catalog & Sourcing:**
   - **Global Search:** Concurrently query external supplier adapters via `/api/v2/product-search` with Redis caching.
   - **On-Demand Import:** Apply platform dynamic margin rules (`PricingRule`) and save imported products into local catalog tables.
   - **Background Synchronization:** Automated 6-hour RabbitMQ worker updates for live supplier stock & price adjustments.
3. **Storefront Taxonomy & Merchandising:**
   - **Categories & Collections:** Hierarchical category trees and curated product collection management (with item reordering).
   - **Attributes & Size Guides:** Custom product variant attributes (color, size, material) and linked size guide reference charts.
4. **Cart, Orders & Checkout:**
   - **Unified Cart:** Handles both authenticated users and guest shoppers using `x-session-id`.
   - **Checkout & Orders:** Split orders across suppliers, calculate totals, track order state machine, and manage customer order history.
5. **Payments & Webhooks:** Payment intent creation and unauthenticated provider webhook handlers (e.g. Stripe, PayMongo) with signature validation logic.
6. **Multi-Location Inventory:** Track warehouse stock levels, allocate variant stock per location, and handle stock reservations.
7. **Marketing & Promotions:** Promo code validation, discount campaigns, dynamic ad link tracking, and Google/Facebook product feed generation.
8. **CMS & Multi-Tenancy:** Multi-tenant vertical configuration (`Tenant`), CMS pages, banners, announcements, and FAQs.

---

## Directory Structure

```text
all-in-one-v2-api/
├── docs/                     # Architectural and API documentation
│   ├── api-guide.md          # Complete REST API reference and endpoint specifications
│   ├── beginner-guide.md     # Onboarding guide for new developers
│   ├── engineering-handbook.md # Development standards, code style, and PR guidelines
│   ├── getting-started.md    # Local setup and environment configuration
│   └── systemSummary/
│       └── system_summary.md # (This file) Core architecture and directory breakdown
├── prisma/
│   ├── schema.prisma         # Database schema (User, Product, Order, Tenant, Cart, etc.)
│   └── seed.ts               # Initial database seed script
├── src/
│   ├── config/               # Environment variables, database connection, and logger setup
│   ├── consumers/            # RabbitMQ worker event consumers (product-sync, etc.)
│   ├── controllers/          # Express route controllers
│   │   ├── attribute.controller.ts
│   │   ├── auth.controller.ts
│   │   ├── cart.controller.ts
│   │   ├── category.controller.ts
│   │   ├── cms.controller.ts
│   │   ├── collection.controller.ts
│   │   ├── health.controller.ts
│   │   ├── inventory.controller.ts
│   │   ├── marketing.controller.ts
│   │   ├── order.controller.ts
│   │   ├── payment.controller.ts
│   │   ├── product-import.controller.ts
│   │   ├── product-search.controller.ts
│   │   ├── product-sync.controller.ts
│   │   ├── promotion.controller.ts
│   │   ├── size-guide.controller.ts
│   │   ├── tenant.controller.ts
│   │   └── user.controller.ts
│   ├── infrastructure/       # Queue, Redis, and cron background connections
│   ├── middleware/           # Auth JWT verification, role guard, error, & file upload middlewares
│   ├── repositories/         # Prisma DB access layer abstracting database queries
│   ├── routes/               # Express API route modules
│   │   ├── index.ts          # Central route registry (/api/v2, /health)
│   │   ├── attribute.route.ts
│   │   ├── auth.route.ts
│   │   ├── cart.route.ts
│   │   ├── category.route.ts
│   │   ├── cms.route.ts
│   │   ├── collection.route.ts
│   │   ├── fileUpload.route.ts
│   │   ├── health.route.ts
│   │   ├── inventory.route.ts
│   │   ├── marketing.routes.ts
│   │   ├── order.route.ts
│   │   ├── payment.route.ts
│   │   ├── product-import.routes.ts
│   │   ├── product-search.routes.ts
│   │   ├── product-sync.route.ts
│   │   ├── promotion.route.ts
│   │   ├── size-guide.route.ts
│   │   ├── tenant.route.ts
│   │   └── user.route.ts
│   ├── services/             # Core business logic layer
│   ├── suppliers/            # Dropshipping supplier adapters & registry
│   ├── types/                # TypeScript type definitions and interfaces
│   ├── utils/                # Utility modules (logger, cache, pricing calculations)
│   ├── app.ts                # Express application configuration & middleware registration
│   ├── server.ts             # HTTP server entry point
│   └── worker.ts             # RabbitMQ background worker process entry point
├── tests/                    # Unit and integration test suites
├── .env                      # Environment variable definitions
├── docker-compose.yml        # Docker setup (PostgreSQL, Redis, RabbitMQ)
└── package.json              # NPM manifest & script commands
```

