import { prisma } from '../../utils/prisma';

export default class AnalyticsRepository {
  static async getDailySales(tenantId: string, startDate: Date, endDate: Date) {
    return prisma.analyticsDailySales.findMany({
      where: {
        tenantId,
        date: { gte: startDate, lte: endDate },
      },
      orderBy: { date: 'asc' },
    });
  }

  static async getProductSales(tenantId: string) {
    return prisma.analyticsProductSales.findMany({
      where: { tenantId },
      orderBy: { totalSold: 'desc' },
      take: 10,
    });
  }

  // New models added for 100% coverage
  static async getCategorySales(tenantId: string) {
    return prisma.analyticsCategorySales.findMany({
      where: { tenantId },
      orderBy: { totalRevenue: 'desc' },
      include: { category: true },
    });
  }

  static async getSupplierAnalytics(tenantId: string) {
    return prisma.analyticsSupplier.findMany({
      where: { tenantId },
      orderBy: { totalOrders: 'desc' },
      include: { supplier: true },
    });
  }

  static async getCustomerAnalytics(tenantId: string) {
    return prisma.analyticsCustomer.findMany({
      where: { tenantId },
      orderBy: { lifetimeSpend: 'desc' },
      include: { customer: true },
      take: 10,
    });
  }
}
