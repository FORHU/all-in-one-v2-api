/**
 * End-to-end smoke test for the CJ Dropshipping sandbox flow — drives a real
 * sandbox order through CJ's servers using a real, currently-listed product
 * (sandbox only fakes payment/fulfillment, not the catalog — see
 * CJDropshippingAdapter's sandbox methods).
 *
 * Flow: searchProducts -> getProduct (real vid) -> placeSandboxOrder ->
 * simulatePay -> advanceSandboxOrder -> updateSandboxTrackNumber ->
 * getOrderStatus. Logs the raw response at every step, since several of
 * CJ's response field names (e.g. the created order's id field) are not
 * confirmed against a live account elsewhere in this codebase either — this
 * script is partly how you'd confirm them.
 *
 * Requires CJ_API_KEY in .env (real CJ account with API access) and Redis
 * reachable (so the access/refresh token gets cached across the several
 * calls below instead of re-authenticating every time, which would burn
 * into CJ's QPS=1-for-free-tier limit fast).
 *
 * Usage:
 *   npx ts-node scripts/test-cj-sandbox.ts [--query=dress] [--logistic="CJPacket Ordinary"] [--fromCountry=CN] [--target=600]
 */
import { redis } from '../src/infrastructure/redis';
import { CJDropshippingAdapter } from '../src/suppliers/cj-dropshipping/cj.adapter';
import type { CJSandboxTargetStatus } from '../src/suppliers/cj-dropshipping/cj.types';

function readFlag(name: string, fallback: string): string {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  return arg ? arg.slice(name.length + 3) : fallback;
}

function log(step: string, payload: unknown) {
  process.stdout.write(`\n--- ${step} ---\n${JSON.stringify(payload, null, 2)}\n`);
}

/** CJ's actual field name for the created order's id isn't confirmed here — try the plausible candidates. */
function extractOrderId(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const record = data as Record<string, unknown>;
  const candidate = record.orderId ?? record.orderNum ?? record.id;
  return typeof candidate === 'string' ? candidate : null;
}

async function main() {
  const query = readFlag('query', 'dress');
  const logisticName = readFlag('logistic', 'CJPacket Ordinary');
  const fromCountryCode = readFlag('fromCountry', 'CN');
  const target = Number(readFlag('target', '600')) as CJSandboxTargetStatus;

  await redis.connect();
  const adapter = new CJDropshippingAdapter();

  process.stdout.write(`1. Searching CJ catalog for "${query}"...\n`);
  const { items, total } = await adapter.searchProducts(query, 1, 5);
  log('searchProducts', { total, firstItem: items[0] });
  if (!items[0])
    throw new Error(`No products found for query "${query}" — try a different --query`);

  const pid = String(items[0].id);
  process.stdout.write(`\n2. Fetching product detail for pid=${pid}...\n`);
  const product = await adapter.getProduct(pid);
  log('getProduct', product);
  const vid = product?.variants?.[0]?.vid;
  if (!vid) throw new Error('Product has no variants with a vid — try a different --query');

  process.stdout.write(`\n3. Placing sandbox order for vid=${vid}...\n`);
  const orderData = (await adapter.placeSandboxOrder(
    {
      orderId: `SANDBOX-TEST-${Date.now()}`,
      items: [{ productVariantId: 'test', supplierVariantExternalId: vid, quantity: 1 }],
      shippingAddress: {
        firstName: 'Sandbox',
        lastName: 'Tester',
        address1: '123 Test Street',
        city: 'Manila',
        state: 'Metro Manila',
        country: 'PH',
        zip: '1000',
        phone: '09171234567',
      },
    },
    { logisticName, fromCountryCode },
  )) as Record<string, unknown> | undefined;
  log('placeSandboxOrder', orderData);

  const orderId = extractOrderId(orderData);
  if (!orderId) {
    process.stdout.write(
      '\nCould not find an order id in the response above (tried orderId/orderNum/id) — ' +
        'inspect the raw payload and adjust extractOrderId() in this script. Stopping here.\n',
    );
    return;
  }

  // createOrderV2 accepts *a* logisticName string without validating it —
  // if it wasn't actually a real option for this order, CJ creates the
  // order anyway but flags it, and every step after this (pay, status,
  // tracking) will then fail. Fix it up front using CJ's own list of what
  // it'll actually accept, rather than guessing again.
  if (orderData?.logisticsMiss) {
    process.stdout.write(
      `\n   logisticsMiss=true — "${logisticName}" wasn't valid for this order. Looking up real options...\n`,
    );
    const options = await adapter.getOrderLogisticsInfo(orderId);
    log('getOrderLogisticsInfo', options);
    // Cheapest in-stock option — arbitrary but reasonable default for a test run.
    const chosen = options.filter((o) => o.hasStock).sort((a, b) => a.postage - b.postage)[0];
    if (!chosen) {
      process.stdout.write(
        '\nCJ returned no in-stock logistics options for this order — stopping here. ' +
          'Inspect the raw payload above; the shipping route may not be served.\n',
      );
      return;
    }
    process.stdout.write(
      `   Using "${chosen.logisticsName}" ($${chosen.postage}, ${chosen.arrivalTime} days)...\n`,
    );
    const fixed = await adapter.updateLogistics({
      id: chosen.id,
      orderCode: orderId,
      logisticName: chosen.logisticsName,
    });
    log('updateLogistics', { fixed });
    if (!fixed) {
      process.stdout.write('\nupdateLogistics was rejected — stopping here.\n');
      return;
    }
  }

  // A freshly created order is CREATED, not UNPAID — simulatePay (and real
  // payBalance) both require UNPAID, so this real (non-sandbox-only) call
  // is still mandatory even for a sandbox order.
  process.stdout.write(`\n4. Confirming order (CREATED -> UNPAID)...\n`);
  const confirmed = await adapter.confirmOrder(orderId);
  log('confirmOrder', { confirmed });
  if (!confirmed) {
    process.stdout.write('\nconfirmOrder was rejected — stopping here.\n');
    return;
  }

  process.stdout.write(`\n5. Simulating payment for orderId=${orderId}...\n`);
  const paid = await adapter.simulatePay({ orderId });
  log('simulatePay', { paid });
  if (!paid) {
    process.stdout.write('\nsimulatePay was rejected — stopping here.\n');
    return;
  }

  process.stdout.write(`\n6. Advancing order to status ${target}...\n`);
  await adapter.advanceSandboxOrder(orderId, target);
  process.stdout.write(`Advanced to ${target}.\n`);

  process.stdout.write(`\n7. Attaching a tracking number...\n`);
  const tracked = await adapter.updateSandboxTrackNumber({
    orderId,
    trackNumber: `SBX${Date.now()}`,
  });
  log('updateSandboxTrackNumber', { tracked });

  process.stdout.write(`\n8. Fetching final order status...\n`);
  const finalStatus = await adapter.getOrderStatus(orderId);
  log('getOrderStatus (final)', finalStatus);

  process.stdout.write('\nSandbox flow completed.\n');
}

main()
  .catch((error) => {
    process.stderr.write(
      `\nSandbox test failed: ${error instanceof Error ? error.message : error}\n`,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await redis.close();
  });
