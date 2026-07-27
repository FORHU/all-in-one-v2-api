import cron from 'node-cron';
import logger from '../../utils/logger';

/**
 * Scheduled Jobs Registry
 *
 * All recurring background tasks are defined here.
 * The scheduler is started by the worker process, not the API.
 *
 * Cron syntax: second(optional) minute hour day-of-month month day-of-week
 *
 * Examples:
 *   "* * * * *"      → every minute
 *   "0 * * * *"      → every hour
 *   "0 0 * * *"      → every day at midnight
 *   "0 0 * * 0"      → every Sunday at midnight
 */

export const startScheduler = () => {
  logger.info('[Scheduler] Registering scheduled jobs...');

  // ── Example: Database cleanup — runs daily at 2:00 AM ────────────────────
  cron.schedule('0 2 * * *', async () => {
    logger.info('[Scheduler] Running daily database cleanup...');
    try {
      // Example: prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
      logger.info('[Scheduler] Daily cleanup completed.');
    } catch (err) {
      logger.error('[Scheduler] Daily cleanup failed:', err);
    }
  });

  // ── Example: Worker metrics flush — every 5 minutes ──────────────────────
  cron.schedule('*/5 * * * *', async () => {
    logger.info('[Scheduler] Flushing stale cache keys...');
    try {
      // Example: CacheUtil.delByPattern("temp:*");
      logger.info('[Scheduler] Cache flush completed.');
    } catch (err) {
      logger.error('[Scheduler] Cache flush failed:', err);
    }
  });

  // ── Product Synchronization — every 6 hours ──────────────────────────────
  cron.schedule('0 */6 * * *', async () => {
    logger.info('[Scheduler] Starting background product sync...');
    try {
      // Need to dynamically import prisma and JobQueueService to avoid circular deps during startup
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { prisma } = require('../../utils/prisma');
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { JobQueueService } = require('../../services/job-queue.service');

      // Get all unique supplier IDs that have products
      const suppliers = await prisma.supplier.findMany({
        where: { products: { some: {} } },
        select: { id: true, name: true },
      });

      for (const supplier of suppliers) {
        // Find all external IDs for this supplier
        const products = await prisma.supplierProduct.findMany({
          where: { supplierId: supplier.id },
          select: { externalId: true },
        });

        const externalIds = products.map((p: { externalId: string }) => p.externalId);

        // Chunk them into batches of 50 to prevent massive RabbitMQ payloads
        const CHUNK_SIZE = 50;
        for (let i = 0; i < externalIds.length; i += CHUNK_SIZE) {
          const chunk = externalIds.slice(i, i + CHUNK_SIZE);
          const jobId = `sync_${supplier.name}_${Date.now()}_${i}`;

          await JobQueueService.publishProductSyncJob(jobId, supplier.name, {
            externalIds: chunk,
          });
        }
      }
      logger.info('[Scheduler] Successfully queued all products for synchronization.');
    } catch (err) {
      logger.error('[Scheduler] Failed to queue product sync:', err);
    }
  });

  logger.info('[Scheduler] All jobs registered.');
};
