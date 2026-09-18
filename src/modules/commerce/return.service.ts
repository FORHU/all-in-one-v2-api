import ReturnRepository from './return.repository';
import OrderRepository from './order.repository';
import PaymentService from './payment.service';
import { requireTenantId } from '../../utils/async-context';
import { throwResponse } from '../../utils/throw-response';
import { OrderStatus, Prisma, ReturnStatus } from '@prisma/client';
import { rabbitmq } from '../../infrastructure/rabbitmq';
import { ROUTING_KEYS } from '../../events/routing-keys';
import logger from '../../utils/logger';

export default class ReturnService {
  static async createReturn(input: {
    orderId: string;
    customerId: string;
    reason: string;
    notes?: string;
  }) {
    const tenantId = requireTenantId();
    return ReturnRepository.createReturn(tenantId, {
      order: { connect: { id: input.orderId } },
      customer: { connect: { id: input.customerId } },
      reason: input.reason,
      ...(input.notes ? { notes: input.notes } : {}),
    });
  }

  static async getReturnsByOrderId(orderId: string) {
    const tenantId = requireTenantId();
    const [order, returns] = await Promise.all([
      ReturnRepository.getOrderSummary(tenantId, orderId),
      ReturnRepository.findByOrderId(tenantId, orderId),
    ]);
    if (!order) {
      return throwResponse(404, 'Order not found');
    }
    return { order, returns };
  }

  /** Paginated admin return list, scoped to the current tenant. */
  static async listReturns(
    page?: number,
    limit?: number,
    search?: string,
    sortBy?: string,
    sortOrder?: 'asc' | 'desc',
    status?: ReturnStatus,
  ) {
    return ReturnRepository.findAll(
      requireTenantId(),
      page,
      limit,
      search,
      sortBy,
      sortOrder,
      status,
    );
  }

  static async approveReturn(returnId: string) {
    const tenantId = requireTenantId();
    const existing = await ReturnRepository.findById(tenantId, returnId);
    if (!existing) {
      return throwResponse(404, 'Return not found');
    }
    if (existing.status !== ReturnStatus.PENDING) {
      return throwResponse(409, `Return is already ${existing.status.toLowerCase()}`);
    }
    await ReturnRepository.updateReturnStatus(tenantId, returnId, ReturnStatus.APPROVED);
    return ReturnRepository.findById(tenantId, returnId);
  }

  static async rejectReturn(returnId: string, notes?: string) {
    const tenantId = requireTenantId();
    const existing = await ReturnRepository.findById(tenantId, returnId);
    if (!existing) {
      return throwResponse(404, 'Return not found');
    }
    if (existing.status !== ReturnStatus.PENDING) {
      return throwResponse(409, `Return is already ${existing.status.toLowerCase()}`);
    }
    await ReturnRepository.updateReturnStatus(tenantId, returnId, ReturnStatus.REJECTED, notes);
    return ReturnRepository.findById(tenantId, returnId);
  }

  /**
   * Issues a real Stripe refund (PaymentService.refundPayment) and records
   * it as a Refund row. The Refund/Payment don't get marked COMPLETED/
   * REFUNDED here — that only happens once Stripe's `charge.refunded`
   * webhook confirms the money actually moved (see
   * PaymentService.handleWebhook and ReturnRepository.markMostRecentPendingRefundCompleted).
   * Return.status advancing to COMPLETED right below is the one place that
   * doesn't wait for that confirmation — a known, pre-existing gap, not
   * introduced here.
   */
  static async issueRefund(orderId: string, returnId: string, amount: number, reason?: string) {
    const tenantId = requireTenantId();

    const existingReturn = await ReturnRepository.findById(tenantId, returnId);
    if (!existingReturn || existingReturn.orderId !== orderId) {
      return throwResponse(404, 'Return not found');
    }
    if (existingReturn.status !== ReturnStatus.APPROVED) {
      return throwResponse(409, 'Return must be approved before a refund can be issued');
    }

    const { transactionId } = await PaymentService.refundPayment(orderId, amount);
    const refund = await ReturnRepository.createRefund(
      tenantId,
      orderId,
      returnId,
      amount,
      transactionId,
      reason,
    );
    await ReturnRepository.updateReturnStatus(tenantId, returnId, ReturnStatus.COMPLETED);

    // A refund covering the full order total closes the order out; a
    // partial refund leaves fulfillment status alone (the schema has no
    // partially-refunded order state).
    const order = await OrderRepository.findById(tenantId, orderId);
    if (order && new Prisma.Decimal(amount).equals(order.totalAmount)) {
      await OrderRepository.updateStatus(tenantId, orderId, OrderStatus.REFUNDED);
    }

    // The Stripe side of the refund is done and already committed above —
    // this is the customer's money moving, and it must not be rolled back
    // or fail the request just because notifying the supplier had trouble.
    // The actual supplier-side refund (e.g. filing a CJ dispute) happens
    // asynchronously in supplier-refund.consumer.ts, per this codebase's
    // "if it takes time, it goes to RabbitMQ" rule — CJ's dispute chain is
    // several sequential HTTP calls and CJ's own (unbounded) review time,
    // nothing an HTTP request should block on.
    try {
      const supplierOrders = await OrderRepository.getSupplierOrders(tenantId, orderId);
      for (const supplierOrder of supplierOrders) {
        // Never placed with the supplier (no externalId) — nothing to
        // refund on their end, whether because checkout never got that far
        // wired up yet or the order was cancelled before placement.
        if (!supplierOrder.externalId) continue;

        await rabbitmq.publish(ROUTING_KEYS.SUPPLIER_ORDER_REFUND_REQUESTED, {
          tenantId,
          supplierOrderId: supplierOrder.id,
          supplierId: supplierOrder.supplier.name,
          externalId: supplierOrder.externalId,
          reason: reason || 'Customer-requested refund',
        });
      }
    } catch (error) {
      logger.error(
        `[ReturnService] Failed to publish supplier refund request(s) for order ${orderId}`,
        error,
      );
    }

    return refund;
  }
}
