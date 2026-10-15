import { sqs, QUEUES, Consumer, JobHandler } from '../infrastructure/sqs';
import { supplierRegistry } from '../suppliers/supplier.registry';
import OrderRepository from '../modules/commerce/order.repository';
import { runWithTenant } from '../utils/async-context';
import logger from '../utils/logger';
import { SUPPLIER_REFUND_CONCURRENCY } from '../config';

export interface SupplierRefundPayload {
  tenantId: string;
  /** The Refund row this request belongs to — the idempotency key. */
  refundId: string;
  supplierOrderId: string;
  /** Registry id, e.g. 'cj-dropshipping' — matches SupplierPartner.name. */
  supplierId: string;
  /** The supplier's own order id/code — CommerceSupplierOrder.externalId. */
  externalId: string;
  reason: string;
}

/**
 * Reacts to ReturnService.issueRefund queuing a refund request for a
 * supplier-fulfilled order (see return.service.ts). This is the async half
 * of the refund flow: the customer's Stripe refund has already been issued
 * synchronously by the time this runs — this only handles telling the
 * supplier, which can involve several sequential HTTP calls (CJ's dispute
 * chain) and unbounded supplier-side review time, neither of which belongs
 * in the original HTTP request.
 *
 * Not every SupplierAdapter implements requestRefund (it's optional on the
 * interface) — suppliers without one (currently Printful, AliExpress) get
 * their CommerceSupplierOrder recorded with requested:false and a reason,
 * not a thrown error, since "this supplier doesn't support automated
 * refunds" isn't a transient failure worth retrying.
 *
 * Idempotency (SQS delivers at least once, and CJ will happily open a second
 * dispute): each Refund's request is tracked per supplier order —
 *   - already DONE        → duplicate delivery, skipped
 *   - still IN_PROGRESS   → an earlier attempt died after (maybe) reaching the
 *                           supplier. Calling again could double-file, so it's
 *                           recorded as needing a manual check instead.
 *   - supplier call threw → the marker is cleared before rethrowing, so SQS
 *                           retries it (nothing was filed).
 */
export const handleSupplierRefund: JobHandler<SupplierRefundPayload> = async (payload) => {
  const { tenantId, refundId, supplierOrderId, supplierId, externalId } = payload;
  if (!tenantId || !refundId || !supplierOrderId || !supplierId || !externalId) {
    throw new Error(`[SupplierRefundConsumer] Invalid payload: ${JSON.stringify(payload)}`);
  }

  await runWithTenant(tenantId, async () => {
    const state = await OrderRepository.getSupplierRefundRequestState(supplierOrderId, refundId);

    if (state === 'DONE') {
      logger.info(
        `[SupplierRefundConsumer] Refund ${refundId} already sent for supplierOrder ${supplierOrderId} — skipping duplicate delivery.`,
      );
      return;
    }

    if (state === 'IN_PROGRESS') {
      logger.warn(
        `[SupplierRefundConsumer] Refund ${refundId} for supplierOrder ${supplierOrderId} has an earlier attempt with no recorded outcome — not calling ${supplierId} again. Needs a manual check.`,
      );
      await OrderRepository.recordSupplierRefundResult(
        supplierOrderId,
        {
          requested: false,
          raw: {
            reason:
              'An earlier attempt was interrupted before its outcome was recorded. Check the supplier dashboard for an existing dispute before filing manually.',
            needsManualReview: true,
          },
        },
        refundId,
      );
      return;
    }

    const adapter = supplierRegistry.get(supplierId);

    if (!adapter.requestRefund) {
      logger.warn(
        `[SupplierRefundConsumer] Supplier '${supplierId}' has no requestRefund ` +
          `implementation — recording as not requested for supplierOrder ${supplierOrderId}.`,
      );
      await OrderRepository.recordSupplierRefundResult(
        supplierOrderId,
        {
          requested: false,
          raw: { reason: `Supplier '${supplierId}' does not support refund requests` },
        },
        refundId,
      );
      return;
    }

    await OrderRepository.setSupplierRefundRequestInProgress(supplierOrderId, refundId, true);

    let result: Awaited<ReturnType<NonNullable<typeof adapter.requestRefund>>>;
    try {
      result = await adapter.requestRefund({ orderId: externalId, reason: payload.reason });
    } catch (error) {
      // The supplier call itself failed, so nothing was filed — clear the
      // marker so the retry is allowed to call again.
      await OrderRepository.setSupplierRefundRequestInProgress(
        supplierOrderId,
        refundId,
        false,
      ).catch((clearError) =>
        logger.error(
          `[SupplierRefundConsumer] Could not clear in-progress marker for refund ${refundId}`,
          clearError,
        ),
      );
      throw error;
    }

    await OrderRepository.recordSupplierRefundResult(supplierOrderId, result, refundId);

    logger.info(
      `[SupplierRefundConsumer] Refund request for supplierOrder ${supplierOrderId} ` +
        `(${supplierId}): requested=${result.requested}` +
        (result.externalRefundId ? `, externalRefundId=${result.externalRefundId}` : ''),
    );
  });
};

export const startSupplierRefundConsumer = (): Consumer =>
  sqs.consume(QUEUES.SUPPLIER_REFUND, handleSupplierRefund, {
    concurrency: SUPPLIER_REFUND_CONCURRENCY,
  });
