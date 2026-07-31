import logger from './utils/logger';
import { redis } from './infrastructure/redis';
import { rabbitmq } from './infrastructure/rabbitmq';

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

  try {
    await rabbitmq.connect();
  } catch (error) {
    logger.warn('RabbitMQ unavailable on startup. Will reconnect in background.', error);
  }

  logger.info('Setup completed.');
}
