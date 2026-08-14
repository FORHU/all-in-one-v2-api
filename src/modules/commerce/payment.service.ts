import PaymentRepository from './payment.repository';
import OrderRepository from './order.repository';
import CustomerRepository from './customer.repository';
import ReturnRepository from './return.repository';
import OrderService, { OrderViewer } from './order.service';
import {
  Prisma,
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
      channel = PaymentChannel.CARD,
      instrument,
      paymentMethodId,
      savePaymentMethod,
      requester,
    } = params;

    // Cash on Delivery isn't processed by any online gateway — ignore
    // whatever gateway was passed alongside it instead of defaulting to
    // PAYMONGO, which would misrepresent how the order was actually paid.
    const gateway =
      channel === PaymentChannel.CASH_ON_DELIVERY
        ? undefined
        : (params.gateway ?? PaymentGateway.PAYMONGO);

    const order = await OrderRepository.findById(requireTenantId(), orderId);
    if (!order) {
      return throwResponse(404, 'Order not found');
    }

    if (!requester.isAdmin && !OrderService.isOrderOwner(order, requester)) {
      return throwResponse(404, 'Order not found');
    }

    // Only a freshly-placed, unpaid order can be paid — blocks creating a
    // PaymentIntent against an order that's already PROCESSING (paid) or
    // CANCELLED, e.g. from a stale checkout tab re-submitting.
    if (order.status !== OrderStatus.PENDING) {
      return throwResponse(409, 'Order is not in a payable state');
    }

    if (channel === PaymentChannel.CASH_ON_DELIVERY) {
      // No online charge to collect — cash is collected at delivery, so the
      // order is confirmed for fulfillment the moment COD is chosen, the
      // same way a card order is confirmed once Stripe's webhook lands.
      // Status stays PENDING (not PAID/CREATED) since no money has actually
      // changed hands yet — that also keeps AnalyticsRollupService.recordOrderSale
      // (revenue recognition, tied to PAID) from firing for uncollected cash.
      // checkoutDirect already sends an "Order Placed" notification, so no
      // duplicate notification is sent here.
      const payment = await PaymentRepository.createPayment({
        order: { connect: { id: orderId } },
        expectedAmount: order.totalAmount,
        amount: order.totalAmount,
        currency: order.currency,
        channel,
        instrument,
        status: PaymentStatus.PENDING,
      });

      await OrderRepository.updateStatus(requireTenantId(), orderId, OrderStatus.PROCESSING);

      return { ...payment, clientSecret: null };
    }

    let stripeClientSecret: string | null = null;
    let gatewayTransactionId: string | undefined;

    if (gateway === PaymentGateway.STRIPE) {
      // Reuse a still-confirmable PaymentIntent from an earlier attempt on
      // this same order (checkout page remount, or a retry before the first
      // one was confirmed) instead of creating a new Stripe PaymentIntent
      // and a new local Payment row every time this endpoint is called.
      const reusable = order.payments?.find(
        (p) =>
          p.gateway === PaymentGateway.STRIPE &&
          p.gatewayTransactionId &&
          (
            [
              PaymentStatus.CREATED,
              PaymentStatus.PENDING,
              PaymentStatus.WAITING_CONFIRMATION,
            ] as PaymentStatus[]
          ).includes(p.status),
      );

      if (reusable?.gatewayTransactionId) {
        const existingIntent = await stripe.paymentIntents.retrieve(reusable.gatewayTransactionId);
        const isStillConfirmable = [
          'requires_payment_method',
          'requires_confirmation',
          'requires_action',
        ].includes(existingIntent.status);
        // An intent created before payment_method_types was restricted to
        // card-only (or with some other now-outdated config) must not be
        // handed back as-is — Stripe won't retroactively narrow an existing
        // PaymentIntent's allowed methods, so a mismatch here means falling
        // through to create a fresh one below instead of reusing this one.
        const matchesCurrentConfig =
          existingIntent.payment_method_types.length === 1 &&
          existingIntent.payment_method_types[0] === 'card';

        if (isStillConfirmable && matchesCurrentConfig) {
          return { ...reusable, clientSecret: existingIntent.client_secret };
        }
      }

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
        // Without this, Stripe defaults to automatic_payment_methods and
        // offers every method enabled in the Dashboard (Bank, Cash App Pay,
        // Amazon Pay, Klarna...) — the storefront only has a card UI.
        payment_method_types: ['card'],
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

  /**
   * Issues a real Stripe refund for an order's paid payment — called by
   * ReturnService.issueRefund when staff approve a return. The local
   * Payment/Order rows are NOT flipped to REFUNDED here; that only happens
   * once Stripe's `charge.refunded` webhook confirms it (see handleWebhook),
   * same "webhook is the source of truth" rule the rest of this file
   * follows for payment confirmation.
   */
  static async refundPayment(orderId: string, amount: number) {
    const order = await OrderRepository.findById(requireTenantId(), orderId);
    if (!order) {
      return throwResponse(404, 'Order not found');
    }

    const paidPayment = order.payments?.find((p) => p.status === PaymentStatus.PAID);
    if (!paidPayment) {
      return throwResponse(409, 'Order has no paid payment to refund');
    }

    if (paidPayment.gateway === PaymentGateway.STRIPE && paidPayment.gatewayTransactionId) {
      const amountInCents = Math.round(amount * 100);
      const stripeRefund = await stripe.refunds.create({
        payment_intent: paidPayment.gatewayTransactionId,
        amount: amountInCents,
      });
      return { transactionId: stripeRefund.id as string | undefined };
    }

    // Cash on Delivery / other non-online channels have no charge to refund
    // through a gateway — the Refund row ReturnService creates from this is
    // the only record; the cash itself is returned outside this system.
    return { transactionId: undefined };
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

            // A payment already marked PAID is final — a late or
            // out-of-order webhook of a different type must not downgrade it.
            const isStaleDowngrade =
              payment.status === PaymentStatus.PAID && nextStatus !== PaymentStatus.PAID;

            if (!isStaleDowngrade) {
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
                await AnalyticsRollupService.recordOrderSale(
                  payment.order.tenantId,
                  payment.orderId,
                );

                // Notification.userId is a foreign key to AuthUser, not
                // CommerceCustomer — order.customerId is the latter, so the
                // real AuthUser id comes from the customer relation instead.
                if (payment.order.customer?.userId) {
                  await NotificationRepository.createNotification(payment.order.tenantId, {
                    user: { connect: { id: payment.order.customer.userId } },
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
      } else if (provider.toUpperCase() === 'STRIPE') {
        const stripeObject = payload.data?.object as Record<string, unknown> | undefined;

        if (
          eventType === 'payment_intent.succeeded' ||
          eventType === 'payment_intent.payment_failed'
        ) {
          const transactionId = stripeObject?.id as string | undefined;
          const payment = transactionId
            ? await PaymentRepository.findByTransactionId(transactionId)
            : null;
          if (payment) {
            let nextStatus: PaymentStatus = PaymentStatus.PENDING;
            if (eventType === 'payment_intent.succeeded') nextStatus = PaymentStatus.PAID;
            if (eventType === 'payment_intent.payment_failed') nextStatus = PaymentStatus.FAILED;

            // A payment already marked PAID is final — a late or
            // out-of-order webhook of a different type must not downgrade it.
            const isStaleDowngrade =
              payment.status === PaymentStatus.PAID && nextStatus !== PaymentStatus.PAID;

            if (!isStaleDowngrade) {
              await PaymentRepository.updatePaymentStatus(payment.id, nextStatus, payload);

              if (nextStatus === PaymentStatus.PAID) {
                await OrderRepository.updateStatus(
                  payment.order.tenantId,
                  payment.orderId,
                  OrderStatus.PROCESSING,
                );
                await AnalyticsRollupService.recordOrderSale(
                  payment.order.tenantId,
                  payment.orderId,
                );

                // Notification.userId is a foreign key to AuthUser, not
                // CommerceCustomer — order.customerId is the latter, so the
                // real AuthUser id comes from the customer relation instead.
                if (payment.order.customer?.userId) {
                  await NotificationRepository.createNotification(payment.order.tenantId, {
                    user: { connect: { id: payment.order.customer.userId } },
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
        } else if (eventType === 'charge.refunded') {
          const paymentIntentId = stripeObject?.payment_intent as string | undefined;
          const amountRefunded = stripeObject?.amount_refunded as number | undefined;
          const payment = paymentIntentId
            ? await PaymentRepository.findByTransactionId(paymentIntentId)
            : null;

          if (payment && amountRefunded != null) {
            // Close out whichever Refund row was created when the refund was
            // issued (see ReturnService.issueRefund) — a refund issued
            // directly from the Stripe Dashboard has no such row, which is
            // fine; there's nothing further to reconcile for it here.
            await ReturnRepository.markMostRecentPendingRefundCompleted(payment.orderId);

            // A full refund is a real order-status change — reuse
            // OrderRepository.updateStatus so Payment gets synced to
            // REFUNDED the same audited way any other order-status-driven
            // payment sync happens (see ORDER_TO_PAYMENT_STATUS there). A
            // partial refund is recorded on the Refund row only; the order's
            // fulfillment status is left untouched.
            const refundedDecimal = new Prisma.Decimal(amountRefunded).div(100);
            if (refundedDecimal.gte(payment.order.totalAmount)) {
              await OrderRepository.updateStatus(
                payment.order.tenantId,
                payment.orderId,
                OrderStatus.REFUNDED,
              );
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
