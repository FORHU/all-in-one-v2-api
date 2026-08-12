import { Prisma } from '@prisma/client';
import { prisma } from '../../utils/prisma';

export default class InventoryRepository {
  // ─── Locations ─────────────────────────────────────────────────────────────

  /** Find all inventory locations for a tenant */
  static async findAllLocations(tenantId: string) {
    return prisma.inventoryLocation.findMany({
      where: { tenantId },
      orderBy: { isPrimary: 'desc' },
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

  // ─── Stocks ────────────────────────────────────────────────────────────────

  /** Get total onHand and available stock across all locations for a variant */
  static async getStockSummaryByVariant(variantId: string) {
    const stocks = await prisma.inventoryStock.findMany({
      where: { variantId },
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

  /** Get total onHand and available stock across all locations for multiple variants */
  static async getStockSummariesForVariants(variantIds: string[]) {
    const stocks = await prisma.inventoryStock.findMany({
      where: { variantId: { in: variantIds } },
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

  /** Upsert stock for a variant at a specific location */
  static async setStock(
    tenantId: string,
    variantId: string,
    locationId: string,
    onHand: number,
    reorderPoint = 5,
  ) {
    const existing = await prisma.inventoryStock.findUnique({
      where: { variantId_locationId: { variantId, locationId } },
    });

    const reserved = existing ? existing.reserved : 0;
    const available = Math.max(0, onHand - reserved);

    return prisma.inventoryStock.upsert({
      where: { variantId_locationId: { variantId, locationId } },
      update: {
        onHand,
        available,
        reorderPoint,
      },
      create: {
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

  /** Reserve stock during checkout */
  static async reserveStock(variantId: string, locationId: string, quantity: number) {
    const stock = await prisma.inventoryStock.findUnique({
      where: { variantId_locationId: { variantId, locationId } },
    });

    if (!stock || stock.available < quantity) {
      throw new Error(`Insufficient stock for variant ${variantId} at location ${locationId}`);
    }

    const newReserved = stock.reserved + quantity;
    const newAvailable = stock.onHand - newReserved;

    const result = await prisma.inventoryStock.updateMany({
      where: {
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

    return prisma.inventoryStock.findUnique({
      where: { variantId_locationId: { variantId, locationId } },
    });
  }

  /** Release reserved stock */
  static async releaseReservation(variantId: string, locationId: string, quantity: number) {
    const stock = await prisma.inventoryStock.findUnique({
      where: { variantId_locationId: { variantId, locationId } },
    });

    if (!stock) return;

    const newReserved = Math.max(0, stock.reserved - quantity);
    const newAvailable = stock.onHand - newReserved;

    const result = await prisma.inventoryStock.updateMany({
      where: {
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

    return prisma.inventoryStock.findUnique({
      where: { variantId_locationId: { variantId, locationId } },
    });
  }

  // New models added for 100% coverage
  static async getTransactions(tenantId: string, locationId: string, variantId?: string) {
    return prisma.inventoryTransaction.findMany({
      where: {
        tenantId,
        ...(variantId ? { productVariantId: variantId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
