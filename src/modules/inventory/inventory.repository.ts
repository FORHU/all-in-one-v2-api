import { Prisma } from '@prisma/client';
import { prisma } from '../../utils/prisma';
import { paginate } from '../../helpers/pagination.helper';

type PrismaClientOrTx = typeof prisma | Prisma.TransactionClient;

export default class InventoryRepository {
  private static readonly LOCATION_SORTABLE_FIELDS = new Set([
    'name',
    'code',
    'type',
    'createdAt',
    'updatedAt',
  ]);

  private static readonly TRANSACTION_SORTABLE_FIELDS = new Set(['createdAt', 'quantity', 'type']);

  // ─── Locations ─────────────────────────────────────────────────────────────

  /** Paginated inventory locations for a tenant, optionally searched by name/code. */
  static async findAllLocations(
    tenantId: string,
    page = 1,
    limit = 20,
    search?: string,
    sortBy?: string,
    sortOrder?: 'asc' | 'desc',
  ) {
    const where: Prisma.InventoryLocationWhereInput = {
      tenantId,
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { code: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const orderBy: Prisma.InventoryLocationOrderByWithRelationInput =
      sortBy && this.LOCATION_SORTABLE_FIELDS.has(sortBy)
        ? { [sortBy]: sortOrder ?? 'asc' }
        : { isPrimary: 'desc' };

    return paginate(prisma.inventoryLocation, {
      where,
      orderBy,
      page,
      limit,
      search,
      sortBy,
      sortOrder,
    });
  }

  /** Find inventory location by ID */
  static async findLocationById(tenantId: string, id: string) {
    return prisma.inventoryLocation.findFirst({
      where: { id, tenantId },
      include: {
        stocks: {
          include: { variant: true },
        },
      },
    });
  }

  /** Create an inventory location (Warehouse, Retail Store, Supplier Hub) */
  static async createLocation(
    tenantId: string,
    data: {
      name: string;
      code: string;
      type: string;
      isPrimary?: boolean;
      address?: Prisma.InputJsonValue;
    },
  ) {
    return prisma.inventoryLocation.create({
      data: {
        ...data,
        tenant: { connect: { id: tenantId } },
      },
    });
  }

  /** Update location */
  static async updateLocation(id: string, data: Prisma.InventoryLocationUpdateInput) {
    return prisma.inventoryLocation.update({
      where: { id },
      data,
    });
  }

  /** The tenant's primary inventory location, falling back to its oldest active one. Never auto-creates one. */
  static async findPrimaryLocation(tenantId: string, client: PrismaClientOrTx = prisma) {
    const primary = await client.inventoryLocation.findFirst({
      where: { tenantId, isPrimary: true, isActive: true },
    });
    if (primary) return primary;
    return client.inventoryLocation.findFirst({
      where: { tenantId, isActive: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ─── Stocks ────────────────────────────────────────────────────────────────

  /** Get total onHand and available stock across all locations for a variant */
  static async getStockSummaryByVariant(tenantId: string, variantId: string) {
    const stocks = await prisma.inventoryStock.findMany({
      where: { tenantId, variantId },
      include: { location: true },
    });

    const totalOnHand = stocks.reduce((sum, s) => sum + s.onHand, 0);
    const totalReserved = stocks.reduce((sum, s) => sum + s.reserved, 0);
    const totalAvailable = stocks.reduce((sum, s) => sum + s.available, 0);

    return {
      variantId,
      totalOnHand,
      totalReserved,
      totalAvailable,
      locations: stocks,
    };
  }

  /**
   * Available stock for a variant, sourced appropriately for how it's fulfilled:
   * - Any InventoryStock rows exist → first-party/warehouse-tracked product,
   *   trust that number as-is (including a real, legitimate 0).
   * - No InventoryStock rows at all → dropship/print-on-demand variant with no
   *   warehouse concept; fall back to the linked SupplierVariant's last-synced
   *   stock count (see ProductImportService), since the supplier — not this
   *   platform — holds the physical goods.
   */
  static async getEffectiveAvailableStock(
    tenantId: string,
    variantId: string,
  ): Promise<
    | { source: 'location'; available: number; summary: Awaited<ReturnType<typeof InventoryRepository.getStockSummaryByVariant>> }
    | { source: 'supplier'; available: number }
  > {
    const summary = await this.getStockSummaryByVariant(tenantId, variantId);
    if (summary.locations.length > 0) {
      return { source: 'location', available: summary.totalAvailable, summary };
    }

    const supplierVariant = await prisma.supplierVariant.findFirst({
      where: { productVariantId: variantId },
      select: { stock: true },
      orderBy: { lastSyncedAt: 'desc' },
    });

    return { source: 'supplier', available: supplierVariant?.stock ?? 0 };
  }

  /** Get total onHand and available stock across all locations for multiple variants */
  static async getStockSummariesForVariants(tenantId: string, variantIds: string[]) {
    const stocks = await prisma.inventoryStock.findMany({
      where: { tenantId, variantId: { in: variantIds } },
    });

    const summaryMap = new Map<
      string,
      { totalOnHand: number; totalReserved: number; totalAvailable: number }
    >();

    for (const id of variantIds) {
      summaryMap.set(id, { totalOnHand: 0, totalReserved: 0, totalAvailable: 0 });
    }

    for (const stock of stocks) {
      const current = summaryMap.get(stock.variantId);
      if (current) {
        current.totalOnHand += stock.onHand;
        current.totalReserved += stock.reserved;
        current.totalAvailable += stock.available;
      }
    }

    return summaryMap;
  }

  /**
   * Upsert stock for a variant at a specific location. Uses an explicit
   * find-then-create-or-updateMany instead of `upsert` because the
   * `variantId_locationId` unique key isn't tenant-qualified — `updateMany`
   * lets the tenant filter be enforced by the query rather than assumed,
   * same idiom as ProductRepository.update(). Accepts an injectable Prisma
   * client so it can run inside a caller's own transaction (e.g. import).
   */
  static async setStock(
    tenantId: string,
    variantId: string,
    locationId: string,
    onHand: number,
    reorderPoint = 5,
    client: PrismaClientOrTx = prisma,
  ) {
    const existing = await client.inventoryStock.findFirst({
      where: { tenantId, variantId, locationId },
    });

    const reserved = existing ? existing.reserved : 0;
    const available = Math.max(0, onHand - reserved);

    if (existing) {
      await client.inventoryStock.updateMany({
        where: { tenantId, variantId, locationId },
        data: { onHand, available, reorderPoint },
      });
    } else {
      await client.inventoryStock.create({
        data: {
          tenantId,
          variantId,
          locationId,
          onHand,
          reserved: 0,
          available: onHand,
          reorderPoint,
        },
      });
    }

    return client.inventoryStock.findFirst({ where: { tenantId, variantId, locationId } });
  }

  /** Reserve stock during checkout */
  static async reserveStock(
    tenantId: string,
    variantId: string,
    locationId: string,
    quantity: number,
  ) {
    const stock = await prisma.inventoryStock.findFirst({
      where: { tenantId, variantId, locationId },
    });

    if (!stock || stock.available < quantity) {
      throw new Error(`Insufficient stock for variant ${variantId} at location ${locationId}`);
    }

    const newReserved = stock.reserved + quantity;
    const newAvailable = stock.onHand - newReserved;

    const result = await prisma.inventoryStock.updateMany({
      where: {
        tenantId,
        variantId,
        locationId,
        version: stock.version,
      },
      data: {
        reserved: newReserved,
        available: Math.max(0, newAvailable),
        version: { increment: 1 },
      },
    });

    if (result.count === 0) {
      throw new Error(
        `Optimistic locking failed: Stock for variant ${variantId} at location ${locationId} was modified by another transaction. Please try again.`,
      );
    }

    return prisma.inventoryStock.findFirst({ where: { tenantId, variantId, locationId } });
  }

  /** Release reserved stock */
  static async releaseReservation(
    tenantId: string,
    variantId: string,
    locationId: string,
    quantity: number,
  ) {
    const stock = await prisma.inventoryStock.findFirst({
      where: { tenantId, variantId, locationId },
    });

    if (!stock) return;

    const newReserved = Math.max(0, stock.reserved - quantity);
    const newAvailable = stock.onHand - newReserved;

    const result = await prisma.inventoryStock.updateMany({
      where: {
        tenantId,
        variantId,
        locationId,
        version: stock.version,
      },
      data: {
        reserved: newReserved,
        available: newAvailable,
        version: { increment: 1 },
      },
    });

    if (result.count === 0) {
      throw new Error(
        `Optimistic locking failed: Stock for variant ${variantId} at location ${locationId} was modified by another transaction. Please try again.`,
      );
    }

    return prisma.inventoryStock.findFirst({ where: { tenantId, variantId, locationId } });
  }

  // New models added for 100% coverage
  static async getTransactions(
    tenantId: string,
    locationId?: string,
    variantId?: string,
    page = 1,
    limit = 20,
    sortBy?: string,
    sortOrder?: 'asc' | 'desc',
  ) {
    const where: Prisma.InventoryTransactionWhereInput = {
      tenantId,
      ...(variantId ? { productVariantId: variantId } : {}),
    };

    const orderBy: Prisma.InventoryTransactionOrderByWithRelationInput =
      sortBy && this.TRANSACTION_SORTABLE_FIELDS.has(sortBy)
        ? { [sortBy]: sortOrder ?? 'asc' }
        : { createdAt: 'desc' };

    return paginate(prisma.inventoryTransaction, {
      where,
      orderBy,
      page,
      limit,
      sortBy,
      sortOrder,
    });
  }
}
