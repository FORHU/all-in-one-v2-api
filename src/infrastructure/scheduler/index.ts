import cron from 'node-cron';
import os from 'os';
import { redis } from '../redis';
import logger from '../../utils/logger';

type ScheduledTask = ReturnType<typeof cron.schedule>;

let tasks: ScheduledTask[] = [];

// Every worker process runs this scheduler, so with more than one worker each
// cron tick fires once per process. The lock makes the product resync queue
// its jobs once per tick, not once per worker. Workers fire within seconds of
// each other; 30 minutes comfortably covers that while expiring long before
// the next 6-hourly tick.
const PRODUCT_SYNC_LOCK_KEY = 'scheduler:lock:product-sync';
const PRODUCT_SYNC_LOCK_TTL_SECONDS = 30 * 60;

/**
 * True when this process won the lock. Fails open when Redis is down: a
 * duplicate resync is harmless (the jobs are idempotent), a skipped one leaves
 * stock and prices stale for six more hours.
 */
export const acquireSchedulerLock = async (key: string, ttlSeconds: number): Promise<boolean> => {
  try {
    const owner = `${os.hostname()}:${process.pid}`;
    const result = await redis.getClient().set(key, owner, { NX: true, EX: ttlSeconds });
    return result === 'OK';
  } catch (err) {
    logger.warn(
      `[Scheduler] Could not take lock ${key} (Redis unavailable?) — running anyway.`,
      err,
    );
    return true;
  }
};

/** The 6-hourly product resync tick. Exported for tests. */
export const runScheduledProductSync = async () => {
  if (!(await acquireSchedulerLock(PRODUCT_SYNC_LOCK_KEY, PRODUCT_SYNC_LOCK_TTL_SECONDS))) {
    logger.info('[Scheduler] Product sync already queued by another worker this tick — skipping.');
    return;
  }

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
};

/** Stops every registered cron task — called on worker shutdown. */
export const stopScheduler = () => {
  tasks.forEach((task) => task.stop());
  tasks = [];
};

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
  const dailyCleanup = cron.schedule('0 2 * * *', async () => {
    logger.info('[Scheduler] Running daily database cleanup...');
    try {
      // Example: prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
      logger.info('[Scheduler] Daily cleanup completed.');
    } catch (err) {
      logger.error('[Scheduler] Daily cleanup failed:', err);
    }
  });

  // ── Example: Worker metrics flush — every 5 minutes ──────────────────────
  const cacheFlush = cron.schedule('*/5 * * * *', async () => {
    logger.info('[Scheduler] Flushing stale cache keys...');
    try {
      // Example: CacheUtil.delByPattern("temp:*");
      logger.info('[Scheduler] Cache flush completed.');
    } catch (err) {
      logger.error('[Scheduler] Cache flush failed:', err);
    }
  });

  // ── Product Synchronization — every 6 hours ──────────────────────────────
  const productSync = cron.schedule('0 */6 * * *', runScheduledProductSync);

  tasks = [dailyCleanup, cacheFlush, productSync];

  logger.info('[Scheduler] All jobs registered.');
};
