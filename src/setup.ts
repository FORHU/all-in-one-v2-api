import logger from './utils/logger';
import { redis } from './infrastructure/redis';
import { rabbitmq } from './infrastructure/rabbitmq';

/**
 * Initial setup logic for the application
 */
export default async function setup() {
  logger.info('Running initial application setup...');

  // Initialize Redis & RabbitMQ infrastructure singletons
  await redis.connect();
  await rabbitmq.connect();

  logger.info('Setup completed.');
}
