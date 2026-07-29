import {
  PrismaClient,
  PaymentGateway,
  PaymentChannel,
  PaymentInstrument,
  PaymentStatus,
} from '@prisma/client';

export const PAYMENT_DEMO_GCASH_ID = 'p5566778-8990-4112-a334-556677889900';
export const PAYMENT_DEMO_STRIPE_ID = 'p6677889-9001-4223-b445-667788990011';

export async function seedPayments(prisma: PrismaClient) {
  process.stdout.write('🌱 Seeding Payments, PaymentEvents & PaymentAttempts...\n');

  // Find demo order
  const order = await prisma.order.findFirst({
    orderBy: { createdAt: 'desc' },
  });

  if (!order) {
    process.stderr.write(
      '⚠️ No order found to seed payments for. Ensure seedCommerce runs first.\n',
    );
    return;
  }

  // 1. Seed PayMongo GCash E-Wallet Payment
  const existingGcashPayment = await prisma.payment.findUnique({
    where: { id: PAYMENT_DEMO_GCASH_ID },
  });

  if (!existingGcashPayment) {
    const gcashPayment = await prisma.payment.create({
      data: {
        id: PAYMENT_DEMO_GCASH_ID,
        orderId: order.id,
        gateway: PaymentGateway.PAYMONGO,
        channel: PaymentChannel.EWALLET,
        instrument: PaymentInstrument.GCASH,
        expectedAmount: order.totalAmount,
        amount: order.totalAmount,
        currency: 'USD',
        status: PaymentStatus.PAID,
        version: 2,
        idempotencyKey: 'idem_key_paymongo_99182',
        gatewayTransactionId: 'paymongo_tx_88912301',
        gatewayPaymentId: 'pay_src_gcash_00192',
        events: {
          create: [
            {
              status: PaymentStatus.CREATED,
              message: 'Payment intent initialized via PayMongo GCash',
            },
            {
              status: PaymentStatus.PROCESSING,
              message: 'Customer redirected to GCash authorization page',
            },
            {
              status: PaymentStatus.PAID,
              message: 'Webhook callback verified: Payment completed successfully',
            },
          ],
        },
        attempts: {
          create: [
            {
              amount: order.totalAmount,
              status: PaymentStatus.PAID,
              rawResponse: { status: 'succeeded', transactionId: 'paymongo_tx_88912301' },
            },
          ],
        },
      },
    });
    process.stdout.write(`✅ Seeded GCash Payment [${gcashPayment.id}]: $${gcashPayment.amount}\n`);
  }

  // 2. Seed Stripe Credit Card Payment
  const existingStripePayment = await prisma.payment.findUnique({
    where: { id: PAYMENT_DEMO_STRIPE_ID },
  });

  if (!existingStripePayment) {
    const stripePayment = await prisma.payment.create({
      data: {
        id: PAYMENT_DEMO_STRIPE_ID,
        orderId: order.id,
        gateway: PaymentGateway.STRIPE,
        channel: PaymentChannel.CARD,
        instrument: PaymentInstrument.VISA,
        expectedAmount: order.totalAmount,
        amount: order.totalAmount,
        currency: 'USD',
        status: PaymentStatus.PAID,
        version: 2,
        idempotencyKey: 'idem_key_stripe_77182',
        gatewayTransactionId: 'pi_3MtwB2LkdIwHu7ix0rW0A5a7',
        gatewayPaymentId: 'ch_3MtwB2LkdIwHu7ix0rW0A5a7',
        events: {
          create: [
            {
              status: PaymentStatus.CREATED,
              message: 'Stripe PaymentIntent created for Visa card ending in 4242',
            },
            {
              status: PaymentStatus.PAID,
              message: 'Stripe webhook payment_intent.succeeded received',
            },
          ],
        },
        attempts: {
          create: [
            {
              amount: order.totalAmount,
              status: PaymentStatus.PAID,
              rawResponse: { status: 'succeeded', id: 'pi_3MtwB2LkdIwHu7ix0rW0A5a7' },
            },
          ],
        },
      },
    });
    process.stdout.write(
      `✅ Seeded Stripe Visa Payment [${stripePayment.id}]: $${stripePayment.amount}\n`,
    );
  }

  process.stdout.write('🎉 Payments seeder executed successfully!\n');
}
