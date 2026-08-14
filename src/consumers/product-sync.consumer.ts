import { rabbitmq } from '../infrastructure/rabbitmq';
import { QUEUES, ROUTING_KEYS } from '../modules/system/job-queue.service';
import { JobService } from '../modules/system/job.service';
import { supplierRegistry } from '../suppliers/supplier.registry';
import logger from '../utils/logger';
import { workerMetrics } from '../utils/worker-metrics';
import { prisma } from '../utils/prisma';
import { ProductImportService } from '../modules/catalog/product-import.service';

interface SyncPayload {
  jobId: string;
  supplierId: string;
  payload: {
    externalIds: string[];
  };
  timestamp: string;
}

export const startProductSyncConsumer = async () => {
  logger.info('[ProductSyncConsumer] Starting consumer...');

  await rabbitmq.consume(
    QUEUES.PRODUCT_SYNC,
    ROUTING_KEYS.PRODUCT_SYNC,
    async (payload: SyncPayload, _metadata: unknown) => {
      const { jobId, supplierId } = payload;
      const { externalIds } = payload.payload;

      const startTime = Date.now();

      try {
        await JobService.updateJobStatus(jobId, 'PROCESSING');
        logger.info(`[ProductSyncConsumer] Processing job ${jobId} for supplier ${supplierId}`);

        const adapter = supplierRegistry.get(supplierId);

        // Fetch supplier model from DB to link correctly
        const supplierModel = await prisma.supplierPartner.findUnique({
          where: { name: supplierId },
        });

        if (!supplierModel) {
          throw new Error(`Supplier ${supplierId} not found in database. Run migrations or seed.`);
        }

        let successCount = 0;
        let failCount = 0;

        for (const externalId of externalIds) {
          try {
            // Dynamic call to the generic adapter
            const rawData = await adapter.getProduct(externalId);

            if (rawData) {
              const rawObj = rawData as Record<string, unknown>;
              const costPrice = parseFloat(String(rawObj?.sellPrice || rawObj?.price || 0));

              // Resync only re-syncs products already imported once — we
              // need the tenant that owns this mapping (product-sync jobs
              // carry no tenantId of their own).
              const existingMapping = await prisma.supplierProduct.findUnique({
                where: {
                  supplierId_externalId: {
                    supplierId: supplierModel.id,
                    externalId: externalId,
                  },
                },
                include: { product: { select: { tenantId: true } } },
              });

              if (!existingMapping?.product) {
                throw new Error(
                  `No existing product mapping for externalId ${externalId} — resync only re-syncs already-imported products, not first-time imports.`,
                );
              }

              // Bookkeeping on SupplierProduct itself (syncStatus/rawData) —
              // the actual catalog write (all variants: price, attributes,
              // stock) goes through the same importProduct() path the
              // initial import uses, so resync can't drift into only
              // updating one arbitrary variant.
              await prisma.supplierProduct.update({
                where: {
                  supplierId_externalId: {
                    supplierId: supplierModel.id,
                    externalId: externalId,
                  },
                },
                data: {
                  rawData,
                  costPrice,
                  syncStatus: 'SUCCESS',
                  lastSyncError: null,
                  lastSyncedAt: new Date(),
                },
              });

              await ProductImportService.importProduct(
                existingMapping.product.tenantId,
                supplierId,
                rawObj,
              );

              successCount++;
            } else {
              failCount++;
              // Mark sync failed if mapping exists
              await prisma.supplierProduct.updateMany({
                where: { supplierId: supplierModel.id, externalId: externalId },
                data: { syncStatus: 'FAILED', lastSyncError: 'Product not found on supplier' },
              });
            }
          } catch (e) {
            const err = e as Error;
            logger.error(`[ProductSyncConsumer] Error syncing externalId ${externalId}`, err);
            failCount++;
            await prisma.supplierProduct.updateMany({
              where: { supplierId: supplierModel.id, externalId: externalId },
              data: { syncStatus: 'FAILED', lastSyncError: err.message || 'Unknown error' },
            });
          }
        }

        await JobService.updateJobPayload(jobId, { successCount, failCount });
        await JobService.updateJobStatus(jobId, 'COMPLETED');

        const durationMs = Date.now() - startTime;
        workerMetrics.recordJob({
          jobId,
          jobType: 'PRODUCT_SYNC',
          durationMs,
          status: 'success',
        });
        logger.info(
          `[ProductSyncConsumer] Job ${jobId} completed in ${durationMs}ms. Success: ${successCount}, Fail: ${failCount}`,
        );
      } catch (error) {
        logger.error(`[ProductSyncConsumer] Fatal error processing job ${jobId}`, error);
        await JobService.updateJobStatus(jobId, 'FAILED', error);
      }
    },
  );

  logger.info(`[ProductSyncConsumer] Listening to queue ${QUEUES.PRODUCT_SYNC}`);
};
