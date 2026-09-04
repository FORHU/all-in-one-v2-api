import { rabbitmq } from '../infrastructure/rabbitmq';
import { ROUTING_KEYS } from '../events/routing-keys';
import { supplierRegistry } from '../suppliers/supplier.registry';
import OrderRepository from '../modules/commerce/order.repository';
import { runWithTenant } from '../utils/async-context';
import logger from '../utils/logger';

interface SupplierRefundPayload {
  tenantId: string;
  supplierOrderId: string;
  /** Registry id, e.g. 'cj-dropshipping' — matches SupplierPartner.name. */
  supplierId: string;
  /** The supplier's own order id/code — CommerceSupplierOrder.externalId. */
  externalId: string;
  reason: string;
}

/**
 * Reacts to ReturnService.issueRefund publishing a refund request for a
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
 */
export const startSupplierRefundConsumer = async () => {
  const QUEUE_NAME = 'supplier-refund.queue';

  await rabbitmq.consume<SupplierRefundPayload>(
    QUEUE_NAME,
    ROUTING_KEYS.SUPPLIER_ORDER_REFUND_REQUESTED,
    async (payload) => {
      await runWithTenant(payload.tenantId, async () => {
        const adapter = supplierRegistry.get(payload.supplierId);

        if (!adapter.requestRefund) {
          logger.warn(
            `[SupplierRefundConsumer] Supplier '${payload.supplierId}' has no requestRefund ` +
              `implementation — recording as not requested for supplierOrder ${payload.supplierOrderId}.`,
          );
          await OrderRepository.recordSupplierRefundResult(payload.supplierOrderId, {
            requested: false,
            raw: { reason: `Supplier '${payload.supplierId}' does not support refund requests` },
          });
          return;
        }

        const result = await adapter.requestRefund({
          orderId: payload.externalId,
          reason: payload.reason,
        });
        await OrderRepository.recordSupplierRefundResult(payload.supplierOrderId, result);

        logger.info(
          `[SupplierRefundConsumer] Refund request for supplierOrder ${payload.supplierOrderId} ` +
            `(${payload.supplierId}): requested=${result.requested}` +
            (result.externalRefundId ? `, externalRefundId=${result.externalRefundId}` : ''),
        );
      });
    },
  );

  logger.info(`[SupplierRefundConsumer] Listening on queue ${QUEUE_NAME}`);
};
