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

  static async getSyncJobs(
    tenantId: string,
    page: number,
    limit: number,
  ): Promise<PageResult<unknown>> {
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

  /**
   * Is `externalId` already imported into THIS tenant's catalog? SupplierProduct
   * rows are global (no tenantId column, shared across every tenant), and
   * `productId` gets overwritten on every import regardless of who's
   * importing — so a row existing at all does NOT mean it belongs to the
   * current tenant. Must join through to CatalogProduct.tenantId to answer
   * "does *this* store already have it" correctly.
   */
  static async findImportedProductForTenant(
    supplierPartnerName: string,
    externalId: string,
    tenantId: string,
  ) {
    return prisma.supplierProduct.findFirst({
      where: {
        externalId,
        supplier: { name: supplierPartnerName },
        product: { tenantId },
      },
      select: {
        productId: true,
        product: { select: { id: true, slug: true, title: true } },
      },
    });
  }

  /** Batch form of findImportedProductForTenant, for decorating a page of search results in one query. */
  static async findImportedExternalIdsForTenant(
    supplierPartnerName: string,
    externalIds: string[],
    tenantId: string,
  ): Promise<Map<string, string>> {
    if (externalIds.length === 0) return new Map();

    const rows = await prisma.supplierProduct.findMany({
      where: {
        externalId: { in: externalIds },
        supplier: { name: supplierPartnerName },
        product: { tenantId },
      },
      select: { externalId: true, productId: true },
    });

    return new Map(
      rows
        .filter((r): r is { externalId: string; productId: string } => r.productId !== null)
        .map((r) => [r.externalId, r.productId]),
    );
  }

  /** Resolves a supplier's registry name (e.g. 'cj-dropshipping') to its SupplierPartner row. */
  static async findPartnerByName(name: string) {
    return prisma.supplierPartner.findUnique({ where: { name } });
  }

  /**
   * Batch-resolves CatalogProductVariant ids to this supplier's own external
   * variant id (e.g. CJ's `vid`), for building a supplier order payload.
   * Variants never synced from this supplier (no matching SupplierVariant
   * row, or one whose productVariantId is still unmapped) are simply absent
   * from the returned map — callers must treat a missing key as "not
   * sourced from this supplier," not as an error on its own.
   */
  static async findVariantMappingsBySupplier(
    supplierPartnerName: string,
    productVariantIds: string[],
  ): Promise<Map<string, string>> {
    if (productVariantIds.length === 0) return new Map();

    const rows = await prisma.supplierVariant.findMany({
      where: {
        productVariantId: { in: productVariantIds },
        supplierProduct: { supplier: { name: supplierPartnerName } },
      },
      select: { productVariantId: true, externalId: true },
    });

    return new Map(
      rows
        .filter((r): r is { productVariantId: string; externalId: string } => r.productVariantId !== null)
        .map((r) => [r.productVariantId, r.externalId]),
    );
  }
}
