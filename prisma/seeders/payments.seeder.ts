import {
  PrismaClient,
  OrderStatus,
  PaymentGateway,
  PaymentChannel,
  PaymentStatus,
  PaymentInstrument,
} from '@prisma/client';
import { TENANT_IDS } from './tenants.seeder';

interface GatewayProfile {
  gateway: PaymentGateway;
  channel: PaymentChannel;
  instrument: PaymentInstrument | null;
  currency: string;
}

// Cycled across each tenant's 5 orders for payment-method variety
const GATEWAY_PROFILES: GatewayProfile[] = [
  {
    gateway: PaymentGateway.PAYMONGO,
    channel: PaymentChannel.EWALLET,
    instrument: PaymentInstrument.GCASH,
    currency: 'PHP',
  },
  {
    gateway: PaymentGateway.STRIPE,
    channel: PaymentChannel.CARD,
    instrument: PaymentInstrument.VISA,
    currency: 'USD',
  },
  {
    gateway: PaymentGateway.PAYPAL,
    channel: PaymentChannel.BANK_TRANSFER,
    instrument: null,
    currency: 'USD',
  },
  {
    gateway: PaymentGateway.XENDIT,
    channel: PaymentChannel.QR,
    instrument: PaymentInstrument.QRPH,
    currency: 'PHP',
  },
  {
    gateway: PaymentGateway.MAYA,
    channel: PaymentChannel.EWALLET,
    instrument: PaymentInstrument.MAYA,
    currency: 'PHP',
  },
];

// Maps the order's fulfillment status onto a realistic payment status
function paymentStatusForOrder(orderStatus: OrderStatus): PaymentStatus {
  switch (orderStatus) {
    case OrderStatus.PENDING:
      return PaymentStatus.PENDING;
    case OrderStatus.PROCESSING:
    case OrderStatus.PARTIALLY_FULFILLED:
      return PaymentStatus.PROCESSING;
    case OrderStatus.FULFILLED:
      return PaymentStatus.PAID;
    case OrderStatus.CANCELLED:
      return PaymentStatus.CANCELLED;
    case OrderStatus.REFUNDED:
      return PaymentStatus.REFUNDED;
    default:
      return PaymentStatus.CREATED;
  }
}

export async function seedPayments(prisma: PrismaClient) {
  process.stdout.write('🌱 Seeding Payments, PaymentEvents & PaymentAttempts for 5 Tenants...\n');

  for (const tenantId of Object.values(TENANT_IDS)) {
    const orders = await prisma.commerceOrder.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
    });

    if (orders.length === 0) {
      process.stderr.write(
        `⚠️ No orders found for tenant [${tenantId}]. Ensure seedCommerce runs first.\n`,
      );
      continue;
    }

    for (let i = 0; i < orders.length; i++) {
      const order = orders[i];

      const existingPayment = await prisma.commercePayment.findFirst({
        where: { orderId: order.id },
      });
      if (existingPayment) continue;

      const profile = GATEWAY_PROFILES[i % GATEWAY_PROFILES.length];
      const status = paymentStatusForOrder(order.status);
      const isSettled = status === PaymentStatus.PAID || status === PaymentStatus.REFUNDED;

      const payment = await prisma.commercePayment.create({
        data: {
          orderId: order.id,
          gateway: profile.gateway,
          channel: profile.channel,
          instrument: profile.instrument,
          expectedAmount: order.totalAmount,
          amount: order.totalAmount,
          currency: profile.currency,
          status,
          gatewayTransactionId: isSettled
            ? `tx_${profile.gateway.toLowerCase()}_${order.id.slice(0, 8)}`
            : null,
          gatewayPaymentId: isSettled
            ? `py_${profile.gateway.toLowerCase()}_${order.id.slice(0, 8)}`
            : null,
          events: {
            create: [
              {
                status: PaymentStatus.CREATED,
                message: `Payment intent created via ${profile.gateway}`,
              },
              { status, message: `Payment moved to ${status} for order ${order.id}` },
            ],
          },
          attempts: {
            create: [
              {
                amount: order.totalAmount,
                status,
                rawResponse: {
                  referenceNo: `${profile.gateway}-REF-${order.id.slice(0, 8).toUpperCase()}`,
                },
              },
            ],
          },
        },
      });

      process.stdout.write(
        `✅ Seeded ${profile.gateway} Payment [${payment.id}] for Order [${order.id}]: ${order.totalAmount} ${profile.currency} (${status})\n`,
      );
    }
  }

  process.stdout.write('🎉 Payments seeder executed successfully for all tenants!\n');
}

export default seedPayments;
