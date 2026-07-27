# Developer Roadmap & System Summary

This document serves as the central guide for developers. It outlines the updated architectural structure of the centralized dropshipping marketplace and the implementation roadmap.

---

## Part 1: System Architecture Summary

The platform follows a **Backend-First Centralized Marketplace Architecture** designed for high scalability. The platform acts as the central merchant, sourcing from multiple suppliers and presenting a unified storefront to customers.

### Dropshipping Workflow

1. **Global Product Search:** Admins search across all active suppliers globally (`/api/v2/product-search`). The backend queries adapters concurrently via `Promise.allSettled`, normalizes results, and caches them in Redis.
2. **On-Demand Importing:** Admins import products (`POST /api/v2/products/import`). The system calculates selling prices using `PricingRule`s and persists to the local catalog (`Product`, `ProductVariant`, `SupplierProduct`).
3. **Background Synchronization:** RabbitMQ cron jobs automatically enqueue imported products every 6 hours. Workers dynamically update platform selling prices and inventory stock to prevent selling out-of-stock items.
4. **Order Fulfillment (Pending):** Customer `Order`s are split into supplier-specific `SupplierOrder`s and dispatched via the adapters.

### Directory Structure

```text
all-in-one-v2-api/
├── prisma/
│   ├── schema.prisma        # Database schema (User, Product, PricingRule, Supplier, etc.)
│   └── seed.ts              # Database seeding script for initial data
├── src/
│   ├── config/              # Environment variables and global configurations
│   ├── consumers/           # RabbitMQ worker logic (e.g., product-sync.consumer.ts)
│   ├── controllers/         # Express route handlers
│   │   ├── product-search.controller.ts
│   │   └── product-import.controller.ts
│   ├── infrastructure/      # Third-party connections (RabbitMQ, Redis, Scheduler)
│   ├── middleware/          # Express middlewares
│   ├── repositories/        # Database access layer abstracting Prisma calls
│   ├── routes/              # Express route definitions
│   │   ├── index.ts
│   │   ├── product-search.routes.ts
│   │   └── product-import.routes.ts
│   ├── services/            # Core business logic
│   │   ├── job-queue.service.ts
│   │   ├── product-import.service.ts # Saves products and applies margins
│   │   └── product-search.service.ts # Supplier aggregation and caching logic
│   ├── suppliers/           # Dropshipping Provider Adapters
│   │   ├── aliexpress/
│   │   ├── cj-dropshipping/
│   │   ├── printful/
│   │   ├── supplier.interface.ts     # The canonical adapter interface
│   │   └── supplier.registry.ts      # Singleton registry holding active adapters
│   ├── types/               # TypeScript interfaces and type definitions
│   ├── utils/               # Reusable utility functions
│   │   ├── cache.util.ts
│   │   ├── pricing.util.ts           # Dynamic margin calculation using PricingRule
│   │   ├── prisma.ts
│   │   └── throw-response.ts
│   ├── app.ts               # Express application setup
│   ├── server.ts            # Entry point for HTTP server
│   └── worker.ts            # Entry point for RabbitMQ background workers
├── tests/                   # Unit and integration tests
├── .env                     # Local environment variables
├── docker-compose.yml       # Docker services for PostgreSQL, Redis, and RabbitMQ
└── package.json             # NPM dependencies and scripts
```

---

## Part 2: Implementation Roadmap

**CRITICAL DIRECTIVE:** The priority is implementing and validating the complete business workflow. The existing schema is sufficiently mature to support an MVP. **Do not add advanced features or significant schema changes until the core end-to-end workflow is proven.**

### ✅ Phase 1: Supplier Integration & Product Flow (COMPLETED)

- **[Done] Complete One Supplier Integration First**
- **[Done] Build the Complete Product Import Workflow:** `POST /api/v2/products/import` is fully functional.
- **[Done] Implement Product Management (Foundation):** Schema includes `ProductListing` properties and dynamic `PricingRule` configurations.
- **[Done] Enable Background Synchronization:** RabbitMQ cron jobs and consumers automatically recalculate platform pricing using `PricingUtil` and update inventory while gracefully logging `syncStatus` and `lastSyncError`.

### ⏳ Phase 2: Frontend E-Commerce Experience (PENDING)

- **[Pending] Develop the Customer Shopping Experience:** Required Features: Product browsing, search, filtering, product detail pages, shopping cart, and checkout.
- **[Pending] Build Administrative Monitoring Tools:** Build UI for admins to view imported products, manually trigger syncs, edit pricing rules, and view the `syncStatus` logs.

### 🚀 Phase 3: Order Fulfillment Pipeline (NEXT BACKEND PRIORITY)

- **[Pending] Integrate Payment Processing:** Wait for successful webhook confirmation before marking an `Order` as paid.
- **[Pending] Implement Automated Order Fulfillment:** After payment confirmation, automatically split customer `Order`s into `SupplierOrder`s. Submit each `SupplierOrder` through the appropriate `SupplierAdapter`.

### ⏸️ Phase 4: Advanced Features (DELAYED FOR POST-MVP)

_Do not implement these until Phases 1-3 are running flawlessly in production._

- Supplier analytics, AI-powered product recommendations, Automatic supplier switching, Elasticsearch indexing.
