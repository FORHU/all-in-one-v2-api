/**
 * End-to-end test fixture for the refund/replacement/return flow.
 *
 * Drives the REAL code paths rather than hand-inserting rows: creates and
 * confirms a genuine Stripe TEST-mode PaymentIntent, creates a real
 * CommerceOrder (status FULFILLED) with that payment attached, uploads a
 * real evidence image through the same uploadToS3 the live evidence-upload
 * route uses, then calls the actual ReturnService.createReturnRequest — the
 * exact method the customer-facing "Request Refund/Return" button calls.
 *
 * Result: a genuine PENDING request sitting on top of a real, refundable
 * Stripe charge, so you can pick up testing from "Admin reviews it" onward
 * in the real admin UI — including actually clicking Process Refund at the
 * end, since the PaymentIntent behind it is real.
 *
 * Refuses to run unless STRIPE_SECRET_KEY is a test-mode key (sk_test_...)
 * — this creates a real (test-mode) charge, and running it against live
 * keys would charge a real, made-up amount to nothing in particular.
 *
 * Pass --orderOnly to stop after creating the FULFILLED order — skips the
 * evidence upload and createReturnRequest call, so you can test the
 * customer-facing "Request Refund/Return" button yourself (including its
 * own image upload) through the real browser UI instead of having the
 * script submit the request for you.
 *
 * Usage:
 *   npx ts-node scripts/seed-test-refund-request.ts [--tenant=fashion] [--customerEmail=someone@example.com] [--reason="Damaged on arrival"] [--orderOnly]
 */
import '../src/config'; // loads .env — must run before reading process.env.STRIPE_SECRET_KEY below
import Stripe from 'stripe';
import { OrderStatus, PaymentStatus, PaymentGateway, PaymentChannel } from '@prisma/client';
import { prisma } from '../src/utils/prisma';
import { runWithTenant } from '../src/utils/async-context';
import ReturnService from '../src/modules/commerce/return.service';
import { uploadToS3 } from '../src/utils/s3.util';

function readFlag(name: string, fallback?: string): string | undefined {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  return arg ? arg.slice(name.length + 3) : fallback;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

// A real, valid 1x1 transparent PNG — not a fake/placeholder string, so the
// evidence gallery in the admin UI has an actual image to render.
const TEST_IMAGE_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

async function main() {
  const tenantSlug = readFlag('tenant', 'fashion') as string;
  const customerEmail = readFlag('customerEmail');
  const reason = readFlag('reason', 'Damaged on arrival') as string;
  const orderOnly = hasFlag('orderOnly');

  const stripeKey = process.env.STRIPE_SECRET_KEY || '';
  if (!stripeKey.startsWith('sk_test_')) {
    throw new Error(
      `STRIPE_SECRET_KEY is not a test-mode key (got "${stripeKey.slice(0, 8)}...") — refusing to run against live Stripe. Switch .env to a sk_test_... key first.`,
    );
  }
  const stripe = new Stripe(stripeKey, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    apiVersion: '2026-07-29.dahlia' as any,
  });

  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant) throw new Error(`No tenant found for slug "${tenantSlug}"`);

  const customer = customerEmail
    ? await prisma.commerceCustomer.findFirst({
        where: { tenantId: tenant.id, email: customerEmail },
      })
    : await prisma.commerceCustomer.findFirst({
        where: { tenantId: tenant.id },
        orderBy: { createdAt: 'asc' },
      });
  if (!customer) {
    throw new Error(
      'No matching customer found — sign up at least one customer on the storefront first, or pass --customerEmail for an existing one.',
    );
  }

  const variant = await prisma.catalogProductVariant.findFirst({
    where: { tenantId: tenant.id, deletedAt: null },
    include: { product: true },
  });
  if (!variant) {
    throw new Error('No product variants found for this tenant — import/seed a product first.');
  }

  const unitPrice = Number(variant.price);
  const amountInCents = Math.round(unitPrice * 100);

  process.stdout.write(
    `Using customer ${customer.email}, product "${variant.product.title}" (${variant.title}) at $${unitPrice.toFixed(2)}\n`,
  );

  process.stdout.write('Creating + confirming a real Stripe TEST PaymentIntent...\n');
  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountInCents,
    currency: 'usd',
    payment_method_types: ['card'],
    payment_method: 'pm_card_visa',
    confirm: true,
    off_session: true,
    description: `[TEST FIXTURE] ${variant.product.title}`,
  });
  if (paymentIntent.status !== 'succeeded') {
    throw new Error(
      `PaymentIntent did not succeed (status=${paymentIntent.status}) — can't continue.`,
    );
  }
  process.stdout.write(`PaymentIntent ${paymentIntent.id} succeeded.\n`);

  const { order, created } = await runWithTenant(tenant.id, async () => {
    process.stdout.write('Creating a real, FULFILLED order with that payment attached...\n');
    const newOrder = await prisma.commerceOrder.create({
      data: {
        tenantId: tenant.id,
        status: OrderStatus.FULFILLED,
        subtotal: unitPrice,
        totalAmount: unitPrice,
        currency: 'USD',
        customerId: customer.id,
        items: {
          create: [
            {
              tenantId: tenant.id,
              productVariantId: variant.id,
              quantity: 1,
              unitPrice,
              productTitle: variant.product.title,
              variantTitle: variant.title,
              sku: variant.sku,
              ...(variant.baseCost != null ? { supplierCost: variant.baseCost } : {}),
            },
          ],
        },
        payments: {
          create: [
            {
              gateway: PaymentGateway.STRIPE,
              channel: PaymentChannel.CARD,
              expectedAmount: unitPrice,
              amount: unitPrice,
              currency: 'USD',
              status: PaymentStatus.PAID,
              gatewayTransactionId: paymentIntent.id,
              gatewayPaymentId: paymentIntent.id,
            },
          ],
        },
      },
      include: { items: true },
    });
    process.stdout.write(
      `Order ${newOrder.orderNumber} (${newOrder.id}) created, status FULFILLED.\n`,
    );

    if (orderOnly) {
      return { order: newOrder, created: null };
    }

    process.stdout.write('Uploading a real evidence image to local S3...\n');
    const evidenceUrl = await uploadToS3({
      buffer: TEST_IMAGE_PNG,
      mimetype: 'image/png',
      originalName: 'test-evidence.png',
      folder: `returns-evidence/${tenantSlug}/${tenant.id}/${customer.id}`,
    });
    process.stdout.write(`Evidence uploaded: ${evidenceUrl}\n`);

    process.stdout.write('Calling the real ReturnService.createReturnRequest()...\n');
    const newReturn = await ReturnService.createReturnRequest({
      orderId: newOrder.id,
      customerId: customer.id,
      items: [{ orderItemId: newOrder.items[0].id, quantity: 1 }],
      requestType: 'REFUND',
      reason,
      description: 'Automated test fixture — package arrived visibly damaged.',
      evidence: [{ url: evidenceUrl, mimeType: 'image/png' }],
    });

    return { order: newOrder, created: newReturn };
  });

  process.stdout.write('\n=== Done ===\n');
  process.stdout.write(`Order:  ${order.orderNumber}  (${order.id})\n`);

  if (created) {
    process.stdout.write(`Return: ${created.id}  — status ${created.status}\n`);
    process.stdout.write(
      '\nOpen the admin app -> Orders -> Returns -> find this request -> View, and continue testing from "Admin reviews it" onward.\n',
    );
  } else {
    process.stdout.write(
      `\nNo return request created (--orderOnly). Sign in as ${customer.email} on the storefront, open this order, and click "Request Refund/Return" to test the upload + submit flow yourself.\n`,
    );
  }
}

main()
  .catch((error) => {
    process.stderr.write(
      `\nFailed: ${error instanceof Error ? error.message : JSON.stringify(error)}\n`,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
