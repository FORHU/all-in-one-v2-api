import { sqs, QUEUES } from '../../infrastructure/sqs';
import { ROUTING_KEYS } from '../../events/routing-keys';
import { JobService } from './job.service';
import logger from '../../utils/logger';

export interface ProductSyncMessage {
  jobId: string;
  supplierId: string;
  payload: {
    externalIds: string[];
  };
  timestamp: string;
}

export class JobQueueService {
  /**
   * Queues a product sync job on the product-sync SQS queue.
   *
   * The tracking Job row already exists by the time this runs, so a failed
   * enqueue marks it FAILED — otherwise it would sit at PENDING forever with
   * nothing ever going to pick it up — and rethrows so the caller's request
   * fails instead of reporting a sync that will never happen.
   */
  static async publishProductSyncJob(
    jobId: string,
    supplierId: string,
    payload: { externalIds: string[] },
  ) {
    const message: ProductSyncMessage = {
      jobId,
      supplierId,
      payload,
      timestamp: new Date().toISOString(),
    };

    try {
      await sqs.enqueue(QUEUES.PRODUCT_SYNC, ROUTING_KEYS.PRODUCT_SYNC, message);
      logger.info(
        `[JobQueueService:publishProductSyncJob] Queued sync job ${jobId} for supplier ${supplierId}`,
      );
      return true;
    } catch (error) {
      logger.error(`[JobQueueService:publishProductSyncJob] Failed to queue job ${jobId}`, error);
      await JobService.updateJobStatus(jobId, 'FAILED', error);
      throw error;
    }
  }
}
