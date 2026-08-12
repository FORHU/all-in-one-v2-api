import { Prisma } from '@prisma/client';
import { prisma } from '../../utils/prisma';

export default class SupplierRepository {
  static async createPartner(data: Prisma.SupplierPartnerCreateInput) {
    return prisma.supplierPartner.create({ data });
  }

  static async findPartners() {
    return prisma.supplierPartner.findMany({
      include: { syncJobs: true },
    });
  }

  static async getSyncJobs(tenantId: string) {
    return prisma.supplierSyncJob.findMany({
      where: { tenantId },
      orderBy: { startedAt: 'desc' },
      include: { supplier: true },
    });
  }

  // New models added for 100% coverage
  static async upsertCredential(supplierId: string, apiKey: string, apiSecret?: string) {
    return prisma.supplierCredential.create({
      data: { supplierId, apiKey, apiSecret, environment: 'production' },
    });
  }

  static async getSyncLogs(supplierId: string) {
    return prisma.supplierSyncLog.findMany({
      where: { supplierId },
    });
  }

  static async getSupplierProducts(supplierId: string) {
    return prisma.supplierProduct.findMany({
      where: { supplierId },
      include: {
        variants: { include: { images: true } },
        images: true,
      },
    });
  }
}
