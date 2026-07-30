import {
  PrismaClient,
  PaymentGateway,
  PaymentChannel,
  PaymentStatus,
  PaymentInstrument,
} from '@prisma/client';
import { TENANT_IDS } from './tenants.seeder';

export async function seedPayments(prisma: PrismaClient) {
  process.stdout.write('🌱 Seeding Payments, PaymentEvents & PaymentAttempts...\n');

  const tenantId = TENANT_IDS.FASHION;
  const order = await prisma.commerceOrder.findFirst({
    where: { tenantId },
  });

  if (!order) {
    process.stderr.write(
      '⚠️ Order not found for fashion tenant. Ensure seedCommerce runs first.\n',
    );
    return;
  }

  // 1. Seed GCash Payment with PaymentEvents & PaymentAttempt
  const gcashPaymentId = 'p5566778-8990-4112-a334-556677889900';
  const existingGcashPayment = await prisma.commercePayment.findUnique({
    where: { id: gcashPaymentId },
  });

  if (!existingGcashPayment) {
    const gcashPayment = await prisma.commercePayment.create({
      data: {
        id: gcashPaymentId,
        orderId: order.id,
        gateway: PaymentGateway.PAYMONGO,
        channel: PaymentChannel.EWALLET,
        instrument: PaymentInstrument.GCASH,
        expectedAmount: order.totalAmount,
        amount: order.totalAmount,
        currency: 'PHP',
        status: PaymentStatus.PAID,
        gatewayTransactionId: 'pay_gcash_tx_998124',
        gatewayPaymentId: 'pay_gcash_py_772183',
        gatewayResponse: {
          id: 'pay_gcash_py_772183',
          type: 'payment',
          attributes: {
            amount: 19998,
            currency: 'PHP',
            status: 'paid',
            source: { type: 'gcash' },
          },
        },
        events: {
          create: [
            {
              status: PaymentStatus.CREATED,
              message: 'Payment intent created via PayMongo GCash',
            },
            {
              status: PaymentStatus.PENDING,
              message: 'Awaiting customer e-wallet authentication',
            },
            {
              status: PaymentStatus.PAID,
              message: 'GCash payment captured successfully',
            },
          ],
        },
        attempts: {
          create: [
            {
              amount: order.totalAmount,
              status: PaymentStatus.PAID,
              rawResponse: { referenceNo: 'GCASH-REF-88912' },
            },
          ],
        },
      },
    });
    process.stdout.write(`✅ Seeded GCash Payment [${gcashPayment.id}]: $${order.totalAmount}\n`);
  }

  // 2. Seed Credit Card Payment
  const cardPaymentId = 'p6677889-9001-4223-b445-667788990011';
  const existingStripePayment = await prisma.commercePayment.findUnique({
    where: { id: cardPaymentId },
  });

  if (!existingStripePayment) {
    const stripePayment = await prisma.commercePayment.create({
      data: {
        id: cardPaymentId,
        orderId: order.id,
        gateway: PaymentGateway.STRIPE,
        channel: PaymentChannel.CARD,
        instrument: PaymentInstrument.VISA,
        expectedAmount: order.totalAmount,
        amount: order.totalAmount,
        currency: 'USD',
        status: PaymentStatus.PAID,
        gatewayTransactionId: 'ch_stripe_tx_334912',
        gatewayPaymentId: 'pi_stripe_py_112938',
        events: {
          create: [
            {
              status: PaymentStatus.PAID,
              message: 'Stripe card authorization & capture successful',
            },
          ],
        },
      },
    });
    process.stdout.write(
      `✅ Seeded Stripe Visa Payment [${stripePayment.id}]: $${order.totalAmount}\n`,
    );
  }

  process.stdout.write('🎉 Payments seeder executed successfully!\n');
}

export default seedPayments;
