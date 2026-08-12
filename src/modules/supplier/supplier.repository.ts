import { Prisma } from '@prisma/client';
import { prisma } from '../../utils/prisma';
import { paginate, type PageResult } from '../../helpers/pagination.helper';

export default class SupplierRepository {
  static async createPartner(data: Prisma.SupplierPartnerCreateInput) {
    return prisma.supplierPartner.create({ data });
  }

  static async findPartners() {
    return prisma.supplierPartner.findMany({
      include: { syncJobs: true },
    });
  }

  static async getSyncJobs(tenantId: string, page: number, limit: number): Promise<PageResult<unknown>> {
    return paginate(prisma.supplierSyncJob, {
      where: { tenantId },
      orderBy: { startedAt: 'desc' },
      // Only the fields the UI needs to label a job's supplier — the
      // partner's `config` JSON can hold API keys/base URLs and must never
      // reach the frontend via a nested include.
      include: { supplier: { select: { id: true, name: true, displayName: true } } },
      page,
      limit,
    });
  }

  // New models added for 100% coverage
  static async upsertCredential(supplierId: string, apiKey: string, apiSecret?: string) {
    return prisma.supplierCredential.create({
      data: { supplierId, apiKey, apiSecret, environment: 'production' },
    });
  }

  static async getSyncLogs(jobId: string) {
    // SupplierSyncLog has no jobId column — it's only ever scoped to a
    // supplier — so "logs for this job" means "logs for this job's supplier."
    const job = await prisma.supplierSyncJob.findUnique({
      where: { id: jobId },
      select: { supplierId: true },
    });
    if (!job) return [];

    return prisma.supplierSyncLog.findMany({
      where: { supplierId: job.supplierId },
      orderBy: { startedAt: 'desc' },
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
