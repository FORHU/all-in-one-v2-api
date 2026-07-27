import PaymentRepository from '../repositories/payment.repository';
import OrderRepository from '../repositories/order.repository';
import { PaymentStatus, SyncStatus, OrderStatus } from '@prisma/client';
import { throwResponse } from '../utils/throw-response';

export default class PaymentService {
  static async createPaymentIntent(params: {
    orderId: string;
    amount: number;
    currency?: string;
    provider: string;
    paymentMethod?: string;
  }) {
    const { orderId, amount, currency = 'PHP', provider, paymentMethod } = params;

    const order = await OrderRepository.findById(orderId);
    if (!order) {
      return throwResponse(404, 'Order not found');
    }

    return PaymentRepository.createPayment({
      order: { connect: { id: orderId } },
      amount,
      currency,
      provider,
      paymentMethod,
      status: PaymentStatus.PENDING,
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
              await OrderRepository.updateStatus(payment.orderId, OrderStatus.PROCESSING);
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
