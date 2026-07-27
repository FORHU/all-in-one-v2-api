# System Architecture Summary & Structure

This document outlines the current architecture and directory structure of the centralized dropshipping marketplace API.

## Core Architecture

The platform follows a **Backend-First Centralized Marketplace Architecture** designed for high scalability and modularity. The frontend never communicates directly with dropshipping suppliers. The platform acts as the central merchant, sourcing from multiple suppliers and presenting a unified storefront to customers.

### Key Components

- **Express.js & TypeScript:** Core framework for routing and business logic.
- **Prisma ORM:** Database access and schema management (`schema.prisma`).
- **Redis:** Caching layer for lightning-fast product searches and supplier data retrieval.
- **RabbitMQ:** Message queue for background jobs (e.g., product synchronization) to ensure API requests are never blocked by slow external supplier calls.
- **Supplier Adapter Pattern:** A unified `SupplierAdapter` interface that every dropshipping supplier (CJ, AliExpress, Printful, etc.) implements, ensuring the core application code remains agnostic to the specific external API being queried.

## Dropshipping Workflow

1. **Global Product Search:** Admins search across all active suppliers globally (`/api/v2/product-search`). The backend queries adapters concurrently via `Promise.allSettled`, normalizes results, and caches them in Redis.
2. **On-Demand Importing:** When an admin finds a product to sell, they import it (`POST /api/v2/products/import`). The system calculates platform selling prices using database `PricingRule`s and persists it to the local catalog (`Product`, `ProductVariant`, `SupplierProduct`). Customers only see these imported, published products.
3. **Background Synchronization:** RabbitMQ cron jobs automatically enqueue imported products every 6 hours. Workers fetch live supplier data and dynamically update platform selling prices and inventory stock to prevent selling out-of-stock items.
4. **Order Fulfillment (Pending):** When a customer purchases items, the backend will split the `Order` into supplier-specific `SupplierOrder`s and dispatch them via the adapters.

## Directory Structure

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
