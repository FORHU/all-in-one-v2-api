/**
 * Event types carried in every queued job's metadata envelope (`eventType`).
 * With SQS each job type has its own queue, so these no longer route
 * anything — they label the job in logs and in the message attributes.
 */
export const ROUTING_KEYS = {
  PRODUCT_SYNC: 'product.sync',
  SUPPLIER_ORDER_REFUND_REQUESTED: 'supplier-order.refund.requested',
} as const;
