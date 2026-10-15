import { JobStatus } from '@prisma/client';
import { sqs, QUEUES, Consumer, JobHandler } from '../infrastructure/sqs';
import type { ProductSyncMessage } from '../modules/system/job-queue.service';
import { JobService } from '../modules/system/job.service';
import { supplierRegistry } from '../suppliers/supplier.registry';
import logger from '../utils/logger';
import { prisma } from '../utils/prisma';
import { ProductImportService } from '../modules/catalog/product-import.service';
import { PRODUCT_SYNC_CONCURRENCY } from '../config';

// A redelivered message for a job that already reached one of these states is
// a duplicate (SQS delivers at least once) — re-running it would only repeat
// supplier calls for nothing.
const SETTLED_JOB_STATES: JobStatus[] = ['COMPLETED', 'FAILED', 'CANCELLED'];

/**
 * Re-syncs one chunk of already-imported products from their supplier.
 *
 * Failure handling, by design:
 *   - A single product failing (not found on the supplier, bad data) is
 *     recorded on its SupplierProduct and counted in failCount — the job
 *     still COMPLETES and the message is deleted. The 6-hourly resync picks
 *     those products up again, same as before the SQS migration.
 *   - Anything that stops the whole job (supplier not seeded, DB
 *     unreachable, adapter missing) is rethrown so SQS retries the message.
 *     The Job row is only marked FAILED on the final attempt, because
 *     JobService refuses to move a job out of FAILED again.
 *
 * Safe to run twice: settled jobs are skipped, and re-importing a product
 * overwrites it with the supplier's current data.
 */
export const handleProductSync: JobHandler<ProductSyncMessage> = async (message, ctx) => {
  const { jobId, supplierId } = message;
  const externalIds = message.payload?.externalIds;

  if (!jobId || !supplierId || !Array.isArray(externalIds)) {
    throw new Error(`[ProductSyncConsumer] Invalid payload: ${JSON.stringify(message)}`);
  }

  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { status: true } });
  if (job && SETTLED_JOB_STATES.includes(job.status)) {
    logger.info(
      `[ProductSyncConsumer] Job ${jobId} is already ${job.status} — skipping duplicate delivery.`,
    );
    return;
  }

  const startTime = Date.now();

  try {
    await JobService.updateJobStatus(jobId, 'PROCESSING');
    logger.info(
      `[ProductSyncConsumer] Processing job ${jobId} for supplier ${supplierId} (attempt ${ctx.receiveCount})`,
    );

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

    logger.info(
      `[ProductSyncConsumer] Job ${jobId} completed in ${Date.now() - startTime}ms. Success: ${successCount}, Fail: ${failCount}`,
    );
  } catch (error) {
    logger.error(`[ProductSyncConsumer] Job ${jobId} failed (attempt ${ctx.receiveCount})`, error);
    if (ctx.isFinalAttempt) {
      await JobService.updateJobStatus(jobId, 'FAILED', error);
    } else {
      await JobService.updateJobPayload(jobId, {
        lastError: error instanceof Error ? error.message : String(error),
        attempts: ctx.receiveCount,
      });
    }
    throw error;
  }
};

export const startProductSyncConsumer = (): Consumer =>
  sqs.consume(QUEUES.PRODUCT_SYNC, handleProductSync, { concurrency: PRODUCT_SYNC_CONCURRENCY });
