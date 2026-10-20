import logger from './utils/logger';
import { redis } from './infrastructure/redis';
import { QUEUES } from './infrastructure/sqs';
import { registerSuppliers } from './suppliers';

/**
 * Initial setup logic for the application
 */
export default async function setup() {
  logger.info('Running initial application setup...');

  try {
    await redis.connect();
  } catch (error) {
    logger.warn('Redis unavailable on startup. Will reconnect in background.', error);
  }

  // SQS has no connection to open. Warn (don't fail) when a queue isn't
  // configured, same as Redis above: everything else still works, and the
  // feature that queues to it fails with a clear error when used.
  const unconfigured = Object.values(QUEUES).filter((queue) => !queue.url);
  if (unconfigured.length) {
    logger.warn(
      `SQS queue URL(s) not set for: ${unconfigured.map((q) => q.name).join(', ')}. Jobs for these queues will fail to enqueue.`,
    );
  }

  registerSuppliers();

  logger.info('Setup completed.');
}
