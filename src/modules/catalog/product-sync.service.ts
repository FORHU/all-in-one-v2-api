import { prisma } from '../../utils/prisma';
import { JobQueueService } from '../system/job-queue.service';
import { JobService } from '../system/job.service';
import { supplierRegistry } from '../../suppliers/supplier.registry';
import { ProductImportService } from './product-import.service';
import { throwResponse } from '../../utils/throw-response';
import logger from '../../utils/logger';

// Keeps each RabbitMQ payload small and each product-sync.consumer.ts job
// finishing in a reasonable time, same rationale as the scheduler's original
// (broken) chunking.
const CHUNK_SIZE = 50;

export class ProductSyncService {
  /**
   * Re-queues every already-imported SupplierProduct (productId set, i.e. it
   * was actually pulled into a tenant's catalog at some point) for a fresh
   * sync through the same product-sync.consumer.ts -> ProductImportService
   * path a manual /products/sync call uses — so price, attributes, images
   * AND stock all get refreshed from the supplier's current data, not just
   * stock in isolation.
   *
   * Used by: the resync-all admin endpoint (tenantId scoped to the caller),
   * the 6-hourly scheduled job (no tenantId — platform-wide), and the
   * one-off scripts/resync-all-products.ts backfill script.
   */
  static async resyncAll(
    options: { supplierName?: string; tenantId?: string } = {},
  ): Promise<{ suppliersQueued: number; jobsQueued: number; productsQueued: number }> {
    const { supplierName, tenantId } = options;

    const suppliers = await prisma.supplierPartner.findMany({
      where: {
        isActive: true,
        ...(supplierName ? { name: supplierName } : {}),
      },
      select: { id: true, name: true },
    });

    let jobsQueued = 0;
    let productsQueued = 0;

    for (const supplier of suppliers) {
      const products = await prisma.supplierProduct.findMany({
        where: {
          supplierId: supplier.id,
          productId: { not: null },
          ...(tenantId ? { product: { tenantId } } : {}),
        },
        select: { externalId: true },
      });

      const externalIds = products.map((p) => p.externalId);
      productsQueued += externalIds.length;

      for (let i = 0; i < externalIds.length; i += CHUNK_SIZE) {
        const chunk = externalIds.slice(i, i + CHUNK_SIZE);

        const job = await JobService.createJob(
          'PRODUCT_SYNC',
          `Resync ${chunk.length} products from ${supplier.name}`,
          {
            supplierId: supplier.name,
            externalIds: chunk,
            total: chunk.length,
            successCount: 0,
            failCount: 0,
          },
        );

        await JobQueueService.publishProductSyncJob(job.id, supplier.name, { externalIds: chunk });
        jobsQueued++;
      }
    }

    logger.info(
      `[ProductSyncService] Queued ${jobsQueued} resync job(s) covering ${productsQueued} product(s) across ${suppliers.length} supplier(s).`,
    );

    return { suppliersQueued: suppliers.length, jobsQueued, productsQueued };
  }

  /**
   * Refreshes one already-imported product synchronously — no RabbitMQ/
   * worker involved, so the caller gets the real result (or a real error)
   * immediately, same path POST /products/import already uses for new
   * imports. Meant for a per-row "Refresh" action where waiting on a queued
   * job would be the wrong UX for a single product.
   */
  static async resyncOne(tenantId: string, productId: string) {
    const supplierProduct = await prisma.supplierProduct.findFirst({
      where: { productId, product: { tenantId } },
      include: { supplier: true },
      orderBy: { lastSyncedAt: 'desc' },
    });

    if (!supplierProduct) {
      throwResponse(404, 'This product has no linked supplier — nothing to resync.');
    }

    const adapter = supplierRegistry.get(supplierProduct.supplier.name);
    const externalData = await adapter.getProduct(supplierProduct.externalId);

    if (!externalData) {
      throwResponse(
        404,
        `Product '${supplierProduct.externalId}' not found on supplier '${supplierProduct.supplier.name}'.`,
      );
    }

    return ProductImportService.importProduct(
      tenantId,
      supplierProduct.supplier.name,
      externalData as Record<string, unknown>,
    );
  }
}
