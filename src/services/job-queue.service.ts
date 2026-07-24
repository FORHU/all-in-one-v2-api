import { rabbitmq } from '../infrastructure/rabbitmq';
import logger from '../utils/logger';

export const QUEUES = {
  PRODUCT_SYNC: 'product.sync.queue',
};

export const ROUTING_KEYS = {
  PRODUCT_SYNC: 'product.sync',
};

export class JobQueueService {
  /**
   * Publishes a generic product sync job to RabbitMQ.
   */
  static async publishProductSyncJob(
    jobId: string,
    supplierId: string,
    payload: { externalIds: string[] },
  ) {
    try {
      const message = {
        jobId,
        supplierId,
        payload,
        timestamp: new Date().toISOString(),
      };

      await rabbitmq.publish(ROUTING_KEYS.PRODUCT_SYNC, message);

      logger.info(
        `[JobQueueService:publishProductSyncJob] Published sync job ${jobId} for supplier ${supplierId}`,
      );
      return true;
    } catch (error) {
      logger.error(`[JobQueueService:publishProductSyncJob] Failed to publish job ${jobId}`, error);
      throw error;
    }
  }
}
