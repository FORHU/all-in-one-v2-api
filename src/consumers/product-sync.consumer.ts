import { rabbitmq } from '../infrastructure/rabbitmq';
import { QUEUES, ROUTING_KEYS } from '../modules/system/job-queue.service';
import { JobService } from '../modules/system/job.service';
import { supplierRegistry } from '../suppliers/supplier.registry';
import logger from '../utils/logger';
import { workerMetrics } from '../utils/worker-metrics';
import { prisma } from '../utils/prisma';
import { calculateVariantPrice } from '../utils/pricing.util';

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

              // Fetch existing mapping to get the PricingRule
              const existingMapping = await prisma.supplierProduct.findUnique({
                where: {
                  supplierId_externalId: {
                    supplierId: supplierModel.id,
                    externalId: externalId,
                  },
                },
                include: { product: { include: { pricingRule: true } } },
              });

              const rule = existingMapping?.product?.pricingRule;
              const priceResult = calculateVariantPrice(costPrice, rule);
              const finalSellingPrice = priceResult.calculatedPrice;

              // Update everything in a transaction to ensure integrity
              await prisma.$transaction(async (tx) => {
                // 1. Upsert SupplierProduct
                const supplierProduct = await tx.supplierProduct.upsert({
                  where: {
                    supplierId_externalId: {
                      supplierId: supplierModel.id,
                      externalId: externalId,
                    },
                  },
                  update: {
                    rawData,
                    costPrice,
                    syncStatus: 'SUCCESS',
                    lastSyncError: null,
                    lastSyncedAt: new Date(),
                  },
                  create: {
                    supplierId: supplierModel.id,
                    externalId: externalId,
                    rawData,
                    costPrice,
                    syncStatus: 'SUCCESS',
                    lastSyncedAt: new Date(),
                  },
                });

                // 2. Fetch the associated ProductVariant to update its price and stock
                const supplierVariant = await tx.supplierVariant.findFirst({
                  where: { supplierProductId: supplierProduct.id },
                });

                if (supplierVariant) {
                  await tx.supplierVariant.update({
                    where: { id: supplierVariant.id },
                    data: { costPrice, rawData, syncStatus: 'SUCCESS', lastSyncError: null },
                  });

                  // Update actual selling price and stock!
                  if (supplierVariant.productVariantId) {
                    await tx.catalogProductVariant.update({
                      where: { id: supplierVariant.productVariantId },
                      data: {
                        price: finalSellingPrice,
                      },
                    });
                  }
                }
              });
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
