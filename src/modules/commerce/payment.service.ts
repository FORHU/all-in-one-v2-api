import PaymentRepository from './payment.repository';
import OrderRepository from './order.repository';
import CustomerRepository from './customer.repository';
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
import NotificationRepository from '../system/notification.repository';
import Stripe from 'stripe';

const stripe = new Stripe((process.env.STRIPE_SECRET_KEY as string) || 'sk_test_123', {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  apiVersion: '2026-07-29.dahlia' as any,
});

export default class PaymentService {
  static async getOrCreateStripeCustomer(tenantId: string, customerId: string) {
    const customer = await CustomerRepository.findById(customerId);
    if (!customer) throwResponse(404, 'Customer not found');

    if (customer.stripeCustomerId) {
      return customer.stripeCustomerId;
    }

    const stripeCustomer = await stripe.customers.create({
      email: customer.email,
      name: `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || undefined,
      metadata: { tenantId, customerId },
    });

    await CustomerRepository.update(customer.id, {
      stripeCustomerId: stripeCustomer.id,
    });

    return stripeCustomer.id;
  }

  static async createSetupIntent(requester: OrderViewer, types: string[] = ['card']) {
    if (!requester.customerId) return throwResponse(401, 'Must be a registered customer');

    const stripeCustomerId = await this.getOrCreateStripeCustomer(
      requireTenantId(),
      requester.customerId,
    );

    const setupIntent = await stripe.setupIntents.create({
      customer: stripeCustomerId,
      payment_method_types: types,
    });

    return { clientSecret: setupIntent.client_secret };
  }

  static async listPaymentMethods(
    requester: OrderViewer,
    type: Stripe.PaymentMethodListParams.Type = 'card',
  ) {
    if (!requester.customerId) return throwResponse(401, 'Must be a registered customer');

    const stripeCustomerId = await this.getOrCreateStripeCustomer(
      requireTenantId(),
      requester.customerId,
    );

    const methods = await stripe.paymentMethods.list({
      customer: stripeCustomerId,
      type,
    });

    return methods.data.map((m) => {
      let details = {};
      if (m.type === 'card' && m.card) {
        details = {
          brand: m.card.brand,
          last4: m.card.last4,
          expMonth: m.card.exp_month,
          expYear: m.card.exp_year,
        };
      } else if (m.type === 'us_bank_account' && m.us_bank_account) {
        details = { bankName: m.us_bank_account.bank_name, last4: m.us_bank_account.last4 };
      } else if (m.type === 'sepa_debit' && m.sepa_debit) {
        details = { bankCode: m.sepa_debit.bank_code, last4: m.sepa_debit.last4 };
      }

      return {
        id: m.id,
        type: m.type,
        isDefault: false,
        ...details,
      };
    });
  }

  static async detachPaymentMethod(requester: OrderViewer, paymentMethodId: string) {
    if (!requester.customerId) return throwResponse(401, 'Must be a registered customer');

    const stripeCustomerId = await this.getOrCreateStripeCustomer(
      requireTenantId(),
      requester.customerId,
    );

    const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
    if (pm.customer !== stripeCustomerId) {
      return throwResponse(403, 'Cannot detach this payment method');
    }

    await stripe.paymentMethods.detach(paymentMethodId);
    return { success: true };
  }

  static async createPaymentIntent(params: {
    orderId: string;
    gateway?: PaymentGateway;
    channel?: PaymentChannel;
    instrument?: PaymentInstrument;
    paymentMethodId?: string;
    savePaymentMethod?: boolean;
    requester: OrderViewer;
  }) {
    const {
      orderId,
      gateway = PaymentGateway.PAYMONGO,
      channel = PaymentChannel.CARD,
      instrument,
      paymentMethodId,
      savePaymentMethod,
      requester,
    } = params;

    const order = await OrderRepository.findById(requireTenantId(), orderId);
    if (!order) {
      return throwResponse(404, 'Order not found');
    }

    if (!requester.isAdmin && !OrderService.isOrderOwner(order, requester)) {
      return throwResponse(404, 'Order not found');
    }

    let stripeClientSecret: string | null = null;
    let gatewayTransactionId: string | undefined;

    if (gateway === PaymentGateway.STRIPE) {
      // Amount must be in the smallest currency unit (e.g. cents)
      const amountInCents = Math.round(order.totalAmount.toNumber() * 100);

      let stripeCustomerId: string | undefined;

      if (requester.customerId && (paymentMethodId || savePaymentMethod)) {
        stripeCustomerId = await this.getOrCreateStripeCustomer(
          requireTenantId(),
          requester.customerId,
        );
      }

      if (paymentMethodId && stripeCustomerId) {
        const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
        if (pm.customer !== stripeCustomerId) {
          return throwResponse(403, 'Invalid payment method');
        }
      }

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency: order.currency.toLowerCase(),
        customer: stripeCustomerId,
        payment_method: paymentMethodId,
        setup_future_usage: savePaymentMethod ? 'off_session' : undefined,
        metadata: {
          orderId: order.id,
          tenantId: requireTenantId(),
        },
      });

      stripeClientSecret = paymentIntent.client_secret;
      gatewayTransactionId = paymentIntent.id;
    }

    // Amount and currency are read from the order, never taken from the request body
    const payment = await PaymentRepository.createPayment({
      order: { connect: { id: orderId } },
      expectedAmount: order.totalAmount,
      amount: order.totalAmount,
      currency: order.currency,
      gateway,
      channel,
      instrument,
      status: PaymentStatus.CREATED,
      ...(gatewayTransactionId ? { gatewayTransactionId } : {}),
    });

    return {
      ...payment,
      clientSecret: stripeClientSecret,
    };
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

              if (payment.order.customerId) {
                await NotificationRepository.createNotification(payment.order.tenantId, {
                  user: { connect: { id: payment.order.customerId } },
                  type: 'PAYMENT_CONFIRMED',
                  channel: 'IN_APP',
                  title: 'Payment Confirmed',
                  message: `Your payment for order ${payment.order.orderNumber} has been received.`,
                  data: { orderId: payment.order.id, orderNumber: payment.order.orderNumber },
                });
              }
            }
          }
        }
      } else if (provider.toUpperCase() === 'STRIPE') {
        const transactionId = payload.data?.object?.id as string | undefined;

        if (
          transactionId &&
          (eventType === 'payment_intent.succeeded' ||
            eventType === 'payment_intent.payment_failed')
        ) {
          const payment = await PaymentRepository.findByTransactionId(transactionId);
          if (payment) {
            let nextStatus: PaymentStatus = PaymentStatus.PENDING;
            if (eventType === 'payment_intent.succeeded') nextStatus = PaymentStatus.PAID;
            if (eventType === 'payment_intent.payment_failed') nextStatus = PaymentStatus.FAILED;

            await PaymentRepository.updatePaymentStatus(payment.id, nextStatus, payload);

            if (nextStatus === PaymentStatus.PAID) {
              await OrderRepository.updateStatus(
                payment.order.tenantId,
                payment.orderId,
                OrderStatus.PROCESSING,
              );
              await AnalyticsRollupService.recordOrderSale(payment.order.tenantId, payment.orderId);

              if (payment.order.customerId) {
                await NotificationRepository.createNotification(payment.order.tenantId, {
                  user: { connect: { id: payment.order.customerId } },
                  type: 'PAYMENT_CONFIRMED',
                  channel: 'IN_APP',
                  title: 'Payment Confirmed',
                  message: `Your payment for order ${payment.order.orderNumber} has been received.`,
                  data: { orderId: payment.order.id, orderNumber: payment.order.orderNumber },
                });
              }
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
