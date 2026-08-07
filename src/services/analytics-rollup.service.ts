import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import logger from '../utils/logger';

/**
 * Maintains the analytics_* rollup tables.
 *
 * These tables are read by the admin dashboard and by the BEST_SELLERS and
 * TRENDING storefront strategies. Nothing wrote to them before, so both
 * strategies returned an empty list on every request without erroring.
 *
 * Recording is exactly-once per order. The rollups are `+=` aggregates that keep
 * no record of which orders produced them, so counting one order twice is
 * silently unrecoverable — you cannot tell an inflated total from a real one
 * after the fact. The claim on `commerce_orders.analyticsRecordedAt` inside the
 * same transaction is what prevents that.
 */
export default class AnalyticsRollupService {
  /**
   * Folds a paid order into every rollup it affects.
   *
   * Safe to call more than once for the same order — a redelivered payment
   * webhook, a replayed job, a manual retry — because only the caller that wins
   * the claim does any work. Returns whether this call is the one that recorded.
   */
  static async recordOrderSale(tenantId: string, orderId: string): Promise<boolean> {
    try {
      return await prisma.$transaction(async (tx) => {
        // Claim the order. `analyticsRecordedAt: null` in the WHERE is the guard:
        // concurrent callers race here and exactly one sees count === 1.
        const claim = await tx.commerceOrder.updateMany({
          where: { id: orderId, tenantId, analyticsRecordedAt: null },
          data: { analyticsRecordedAt: new Date() },
        });

        if (claim.count !== 1) return false;

        const order = await tx.commerceOrder.findFirstOrThrow({
          where: { id: orderId, tenantId },
          include: {
            items: {
              include: {
                productVariant: {
                  select: { productId: true, product: { select: { categoryId: true } } },
                },
              },
            },
          },
        });

        const orderRevenue = new Prisma.Decimal(order.totalAmount);
        const soldAt = order.createdAt;

        // ---- Per-product totals -------------------------------------------
        // Group first: an order with two variants of the same product is one
        // order for that product, not two, or totalOrders drifts above the real
        // order count and every per-order average derived from it is wrong.
        const byProduct = new Map<string, { qty: number; revenue: Prisma.Decimal }>();
        const byCategory = new Map<string, { qty: number; revenue: Prisma.Decimal }>();

        for (const item of order.items) {
          const lineTotal = new Prisma.Decimal(item.unitPrice).times(item.quantity);
          const productId = item.productVariant.productId;

          const product = byProduct.get(productId) ?? { qty: 0, revenue: new Prisma.Decimal(0) };
          byProduct.set(productId, {
            qty: product.qty + item.quantity,
            revenue: product.revenue.plus(lineTotal),
          });

          const categoryId = item.productVariant.product.categoryId;
          if (categoryId) {
            const category = byCategory.get(categoryId) ?? {
              qty: 0,
              revenue: new Prisma.Decimal(0),
            };
            byCategory.set(categoryId, {
              qty: category.qty + item.quantity,
              revenue: category.revenue.plus(lineTotal),
            });
          }
        }

        for (const [productId, totals] of byProduct) {
          await tx.analyticsProductSales.upsert({
            where: { tenantId_productId: { tenantId, productId } },
            create: {
              tenantId,
              productId,
              totalSold: totals.qty,
              totalRevenue: totals.revenue,
              totalOrders: 1,
              lastSoldAt: soldAt,
            },
            update: {
              totalSold: { increment: totals.qty },
              totalRevenue: { increment: totals.revenue },
              totalOrders: { increment: 1 },
              lastSoldAt: soldAt,
            },
          });
        }

        // ---- Per-category totals ------------------------------------------
        for (const [categoryId, totals] of byCategory) {
          await tx.analyticsCategorySales.upsert({
            where: { tenantId_categoryId: { tenantId, categoryId } },
            create: {
              tenantId,
              categoryId,
              totalRevenue: totals.revenue,
              totalOrders: 1,
              totalProductsSold: totals.qty,
            },
            update: {
              totalRevenue: { increment: totals.revenue },
              totalOrders: { increment: 1 },
              totalProductsSold: { increment: totals.qty },
            },
          });
        }

        // ---- Per-customer lifetime value -----------------------------------
        // Guest orders carry no customerId and are counted in daily/product
        // totals but not here, which is correct: there is no customer to attribute
        // a lifetime to.
        if (order.customerId) {
          const existing = await tx.analyticsCustomer.findUnique({
            where: { tenantId_customerId: { tenantId, customerId: order.customerId } },
          });

          const totalOrders = (existing?.totalOrders ?? 0) + 1;
          const lifetimeSpend = new Prisma.Decimal(existing?.lifetimeSpend ?? 0).plus(orderRevenue);

          await tx.analyticsCustomer.upsert({
            where: { tenantId_customerId: { tenantId, customerId: order.customerId } },
            create: {
              tenantId,
              customerId: order.customerId,
              lifetimeSpend,
              totalOrders,
              // Divide only at the end, off the running totals, so the average
              // never compounds its own rounding error.
              avgOrderValue: lifetimeSpend.dividedBy(totalOrders),
              lastOrderedAt: soldAt,
            },
            update: {
              lifetimeSpend,
              totalOrders,
              avgOrderValue: lifetimeSpend.dividedBy(totalOrders),
              lastOrderedAt: soldAt,
            },
          });
        }

        // ---- Daily totals ---------------------------------------------------
        // Truncated to UTC midnight to match the @db.Date column.
        const day = new Date(
          Date.UTC(soldAt.getUTCFullYear(), soldAt.getUTCMonth(), soldAt.getUTCDate()),
        );

        await tx.analyticsDailySales.upsert({
          where: { tenantId_date: { tenantId, date: day } },
          create: { tenantId, date: day, ordersCount: 1, revenueAmount: orderRevenue },
          update: {
            ordersCount: { increment: 1 },
            revenueAmount: { increment: orderRevenue },
          },
        });

        return true;
      });
    } catch (error) {
      // Analytics must never fail a payment. The order stays unclaimed
      // (the transaction rolled the claim back with everything else), so a
      // later retry can still record it.
      logger.error('Failed to record order sale in analytics rollups', {
        tenantId,
        orderId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Recomputes `bestSellingProductId` for one tenant-day.
   *
   * Kept out of recordOrderSale deliberately: answering "which product sold most
   * today" means scanning every order for that day, which is wasted work on each
   * individual sale. Call this from a scheduled job instead.
   */
  static async refreshDailyBestSeller(tenantId: string, day: Date): Promise<void> {
    const dayStart = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()));
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    const [best] = await prisma.$queryRaw<{ productId: string }[]>`
      SELECT v."productId", SUM(i.quantity)::int AS sold
      FROM commerce_order_items i
      JOIN commerce_orders o ON o.id = i."orderId"
      JOIN catalog_product_variants v ON v.id = i."productVariantId"
      WHERE o."tenantId" = ${tenantId}
        AND o."analyticsRecordedAt" IS NOT NULL
        AND o."createdAt" >= ${dayStart}
        AND o."createdAt" < ${dayEnd}
      GROUP BY v."productId"
      ORDER BY sold DESC
      LIMIT 1
    `;

    if (!best) return;

    await prisma.analyticsDailySales.updateMany({
      where: { tenantId, date: dayStart },
      data: { bestSellingProductId: best.productId },
    });
  }
}
