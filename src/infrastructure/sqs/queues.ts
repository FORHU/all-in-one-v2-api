import { PRODUCT_SYNC_QUEUE_URL, SUPPLIER_REFUND_QUEUE_URL } from '../../config';

export interface QueueDefinition {
  /** Short name, used in logs and metrics. */
  name: string;
  /** Full queue URL from the environment — empty when unconfigured. */
  url: string;
}

/**
 * Every queue this app uses. SQS can't route by message type, so each job
 * type gets its own queue (and its own DLQ, configured on the queue itself
 * via a redrive policy — see docker/localstack/init-queues.sh).
 */
export const QUEUES = {
  PRODUCT_SYNC: { name: 'product-sync', url: PRODUCT_SYNC_QUEUE_URL },
  SUPPLIER_REFUND: { name: 'supplier-refund', url: SUPPLIER_REFUND_QUEUE_URL },
} satisfies Record<string, QueueDefinition>;

/** The queue's URL, or a hard failure naming the env var to set. */
export const requireQueueUrl = (queue: QueueDefinition): string => {
  if (!queue.url) {
    const envVar = `${queue.name.replace(/-/g, '_').toUpperCase()}_QUEUE_URL`;
    throw new Error(`[SQS] ${envVar} is not set — cannot use the ${queue.name} queue.`);
  }
  return queue.url;
};
