import PaymentRepository from './payment.repository';
import OrderRepository from './order.repository';
import OrderService, { OrderViewer } from './order.service';
import {
  PaymentStatus,
  SyncStatus,
  OrderStatus,
  PaymentGateway,
  PaymentChannel,
  PaymentInstrument,
} from '@prisma/client';
import { throwResponse } from '../../utils/throw-response';
import { requireTenantId } from '../../utils/async-context';
import { deriveWebhookEventId } from '../../utils/webhook-identity';
import AnalyticsRollupService from '../system/analytics-rollup.service';

export default class PaymentService {
  static async createPaymentIntent(params: {
    orderId: string;
    gateway?: PaymentGateway;
    channel?: PaymentChannel;
    instrument?: PaymentInstrument;
    requester: OrderViewer;
  }) {
    const {
      orderId,
      gateway = PaymentGateway.PAYMONGO,
      channel = PaymentChannel.CARD,
      instrument,
      requester,
    } = params;

    const order = await OrderRepository.findById(requireTenantId(), orderId);
    if (!order) {
      return throwResponse(404, 'Order not found');
    }

    if (!requester.isAdmin && !OrderService.isOrderOwner(order, requester)) {
      return throwResponse(404, 'Order not found');
    }

    // Amount and currency are read from the order, never taken from the request body
    return PaymentRepository.createPayment({
      order: { connect: { id: orderId } },
      expectedAmount: order.totalAmount,
      amount: order.totalAmount,
      currency: order.currency,
      gateway,
      channel,
      instrument,
      status: PaymentStatus.CREATED,
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static async handleWebhook(provider: string, eventType: string, payload: any) {
    const externalEventId = deriveWebhookEventId(payload);
    const { event: webhookEvent, claimed } = await PaymentRepository.recordWebhookEvent(
      provider,
      externalEventId,
      eventType,
      payload,
    );

    // A redelivery we have already handled (or are handling). Acknowledge with 2xx
    // so the gateway stops retrying, but do not apply the payment a second time.
    if (!claimed) {
      return { success: true, webhookId: webhookEvent.id, duplicate: true };
    }

    try {
      if (provider.toUpperCase() === 'PAYMONGO') {
        const data = payload?.data as Record<string, unknown> | undefined;
        const attributes = data?.attributes as Record<string, unknown> | undefined;
        const status = attributes?.status as string | undefined;
        const transactionId = data?.id as string | undefined;

        if (transactionId && status) {
          const payment = await PaymentRepository.findByTransactionId(transactionId);
          if (payment) {
            let nextStatus: PaymentStatus = PaymentStatus.PENDING;
            if (status === 'paid' || status === 'succeeded') nextStatus = PaymentStatus.PAID;
            if (status === 'failed') nextStatus = PaymentStatus.FAILED;

            await PaymentRepository.updatePaymentStatus(payment.id, nextStatus, payload);

            if (nextStatus === PaymentStatus.PAID) {
              // Provider callbacks carry no host or session, so there is no
              // ambient tenant here. Take it from the order the payment points
              // at — the webhook's own data is the source of truth.
              await OrderRepository.updateStatus(
                payment.order.tenantId,
                payment.orderId,
                OrderStatus.PROCESSING,
              );

              // Payment confirmed is where revenue is recognised. This is
              // exactly-once on its own claim, so it stays correct even if the
              // dedupe above is bypassed or this webhook is replayed.
              await AnalyticsRollupService.recordOrderSale(payment.order.tenantId, payment.orderId);
            }
          }
        }
      }

      await PaymentRepository.updateWebhookStatus(webhookEvent.id, SyncStatus.SUCCESS);
      return { success: true, webhookId: webhookEvent.id, duplicate: false };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      await PaymentRepository.updateWebhookStatus(webhookEvent.id, SyncStatus.FAILED, errorMsg);
      throw error;
    }
  }

  static async getPaymentEvents(paymentId: string) {
    return PaymentRepository.getPaymentEvents(requireTenantId(), paymentId);
  }

  static async getPaymentAttempts(paymentId: string) {
    return PaymentRepository.getPaymentAttempts(requireTenantId(), paymentId);
  }
}
