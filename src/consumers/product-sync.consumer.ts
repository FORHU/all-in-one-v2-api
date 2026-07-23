import { rabbitmq } from '../infrastructure/rabbitmq';
import { QUEUES, ROUTING_KEYS } from '../services/job-queue.service';
import { JobService } from '../services/job.service';
import { supplierRegistry } from '../suppliers/supplier.registry';
import logger from '../utils/logger';
import { workerMetrics } from '../utils/worker-metrics';
import { prisma } from '../utils/prisma';

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
    async (payload: any, metadata: any) => {
      const { jobId, supplierId } = payload;
      const { externalIds } = payload.payload;

      const startTime = Date.now();

      try {
        await JobService.updateJobStatus(jobId, 'PROCESSING');
        logger.info(`[ProductSyncConsumer] Processing job ${jobId} for supplier ${supplierId}`);

        const adapter = supplierRegistry.get(supplierId);

        // Fetch supplier model from DB to link correctly
        const supplierModel = await prisma.supplier.findUnique({
          where: { name: supplierId }
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
              // Upsert the raw data into our canonical SupplierProduct table
              await prisma.supplierProduct.upsert({
                where: {
                  supplierId_externalId: {
                    supplierId: supplierModel.id,
                    externalId: externalId
                  }
                },
                update: {
                  rawData,
                  lastSyncedAt: new Date(),
                },
                create: {
                  supplierId: supplierModel.id,
                  externalId: externalId,
                  rawData,
                  costPrice: 0, // Placeholder, mapped adapter logic would fill this
                  lastSyncedAt: new Date(),
                }
              });
              successCount++;
            } else {
              failCount++;
            }
          } catch (e) {
             logger.error(`[ProductSyncConsumer] Error syncing externalId ${externalId}`, e);
             failCount++;
          }
        }

        await JobService.updateJobPayload(jobId, { successCount, failCount });
        await JobService.updateJobStatus(jobId, 'COMPLETED');

        const durationMs = Date.now() - startTime;
        workerMetrics.recordJob({
          jobId,
          jobType: 'PRODUCT_SYNC',
          durationMs,
          status: 'success'
        });
        logger.info(`[ProductSyncConsumer] Job ${jobId} completed in ${durationMs}ms. Success: ${successCount}, Fail: ${failCount}`);
      } catch (error) {
        logger.error(`[ProductSyncConsumer] Fatal error processing job ${jobId}`, error);
        await JobService.updateJobStatus(jobId, 'FAILED', error);
      }
    }
  );

  logger.info(`[ProductSyncConsumer] Listening to queue ${QUEUES.PRODUCT_SYNC}`);
};
