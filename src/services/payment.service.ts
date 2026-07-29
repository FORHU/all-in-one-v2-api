import PaymentRepository from '../repositories/payment.repository';
import OrderRepository from '../repositories/order.repository';
import OrderService, { OrderViewer } from './order.service';
import {
  PaymentStatus,
  SyncStatus,
  OrderStatus,
  PaymentGateway,
  PaymentChannel,
  PaymentInstrument,
} from '@prisma/client';
import { throwResponse } from '../utils/throw-response';
import { requireTenantId } from '../utils/async-context';

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
    const webhookEvent = await PaymentRepository.recordWebhookEvent(provider, eventType, payload);

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
            }
          }
        }
      }

      await PaymentRepository.updateWebhookStatus(webhookEvent.id, SyncStatus.SUCCESS);
      return { success: true, webhookId: webhookEvent.id };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      await PaymentRepository.updateWebhookStatus(webhookEvent.id, SyncStatus.FAILED, errorMsg);
      throw error;
    }
  }
}
