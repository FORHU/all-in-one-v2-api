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
      // Dynamic import to avoid circular deps during startup, same as before.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { ProductSyncService } = require('../../modules/catalog/product-sync.service');
      const result = await ProductSyncService.resyncAll();
      logger.info(
        `[Scheduler] Queued ${result.jobsQueued} product sync job(s) covering ${result.productsQueued} product(s).`,
      );
    } catch (err) {
      logger.error('[Scheduler] Failed to queue product sync:', err);
    }
  });

  logger.info('[Scheduler] All jobs registered.');
};
