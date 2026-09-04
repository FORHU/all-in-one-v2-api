/**
 * Smoke test for CJDropshippingAdapter's cancelOrder and dispute (refund)
 * methods, against real sandbox orders on CJ's servers.
 *
 * Two independent runs, since CJ's cancel and refund mechanisms only apply
 * at different stages of an order's life (see cj.adapter.ts's "Cancel &
 * Refund" section):
 *
 *   1. Cancel  — places a sandbox order and deliberately does NOT confirm
 *      it, then calls cancelOrder(). Expected to succeed: deleteOrder only
 *      works on CREATED/IN_CART orders, and a freshly created order is
 *      exactly that.
 *
 *   2. Refund  — places, fixes logistics if needed, confirms, and
 *      simulate-pays a sandbox order (same sequence as test-cj-sandbox.ts),
 *      then drives it through getDisputeProducts -> getDisputeConfirmInfo
 *      -> createDispute -> getDisputeDetail/getDisputeList. CJ's sandbox has
 *      no dispute simulation, so success here only proves the request
 *      shapes and response parsing are correct — it does NOT prove a real
 *      refund would be approved. If CJ rejects the dispute outright because
 *      the order is a sandbox order, that will show up as a non-success
 *      `result`/`code` in the logged response, not a thrown error.
 *
 * Requires CJ_API_KEY in .env and Redis reachable (token caching) — same
 * prerequisites as test-cj-sandbox.ts.
 *
 * Usage:
 *   npx ts-node scripts/test-cj-cancel-refund.ts [--query=dress] [--logistic="CJPacket Ordinary"] [--fromCountry=CN] [--only=cancel|refund]
 */
import { redis } from '../src/infrastructure/redis';
import { CJDropshippingAdapter } from '../src/suppliers/cj-dropshipping/cj.adapter';
import type { CJProductListV2Item, CJProductDetail } from '../src/suppliers/cj-dropshipping/cj.types';

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

async function findTestVariant(
  adapter: CJDropshippingAdapter,
  query: string,
): Promise<{ pid: string; vid: string; product: CJProductDetail }> {
  const { items } = await adapter.searchProducts(query, 1, 5);
  const first = items[0] as CJProductListV2Item | undefined;
  if (!first) throw new Error(`No products found for query "${query}" — try a different --query`);

  const pid = String(first.id);
  const product = await adapter.getProduct(pid);
  const vid = product?.variants?.[0]?.vid;
  if (!vid) throw new Error('Product has no variants with a vid — try a different --query');

  return { pid, vid, product };
}

/**
 * Places a sandbox order and — if CJ flagged the requested logistic as
 * invalid — corrects it via getOrderLogisticsInfo/updateLogistics, same as
 * test-cj-sandbox.ts. Returns the resolved orderId, or null if the run
 * should stop (already logged why).
 */
async function placeAndFixLogistics(
  adapter: CJDropshippingAdapter,
  vid: string,
  logisticName: string,
  fromCountryCode: string,
  orderIdPrefix: string,
): Promise<string | null> {
  const orderData = (await adapter.placeSandboxOrder(
    {
      orderId: `${orderIdPrefix}-${Date.now()}`,
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
      'Could not find an order id in the response above (tried orderId/orderNum/id) — stopping this run.\n',
    );
    return null;
  }

  if (orderData?.logisticsMiss) {
    process.stdout.write(`   logisticsMiss=true — looking up real logistics options...\n`);
    const options = await adapter.getOrderLogisticsInfo(orderId);
    const chosen = options.filter((o) => o.hasStock).sort((a, b) => a.postage - b.postage)[0];
    if (!chosen) {
      process.stdout.write('CJ returned no in-stock logistics options — stopping this run.\n');
      return null;
    }
    const fixed = await adapter.updateLogistics({
      id: chosen.id,
      orderCode: orderId,
      logisticName: chosen.logisticsName,
    });
    if (!fixed) {
      process.stdout.write('updateLogistics was rejected — stopping this run.\n');
      return null;
    }
  }

  return orderId;
}

/** Run 1: cancel a freshly created, never-confirmed sandbox order. */
async function testCancel(adapter: CJDropshippingAdapter, vid: string, logisticName: string, fromCountryCode: string) {
  process.stdout.write('\n========== CANCEL TEST ==========\n');
  process.stdout.write('1. Placing sandbox order (will NOT be confirmed)...\n');
  const orderId = await placeAndFixLogistics(adapter, vid, logisticName, fromCountryCode, 'SANDBOX-CANCEL');
  if (!orderId) return;

  process.stdout.write(`\n2. Order ${orderId} is still CREATED — calling cancelOrder()...\n`);
  const cancelled = await adapter.cancelOrder(orderId);
  log('cancelOrder', { cancelled });

  process.stdout.write(`\n3. Confirming the order is gone via getOrderStatus...\n`);
  const status = await adapter.getOrderStatus(orderId);
  log('getOrderStatus (after cancel)', status);

  process.stdout.write(
    cancelled
      ? '\nCancel test: cancelOrder reported success.\n'
      : '\nCancel test: cancelOrder reported failure — check the logged response above for why.\n',
  );
}

/** Run 2: confirm + pay a sandbox order, then attempt the dispute (refund) flow against it. */
async function testRefund(adapter: CJDropshippingAdapter, vid: string, logisticName: string, fromCountryCode: string) {
  process.stdout.write('\n========== REFUND (DISPUTE) TEST ==========\n');
  process.stdout.write('1. Placing sandbox order...\n');
  const orderId = await placeAndFixLogistics(adapter, vid, logisticName, fromCountryCode, 'SANDBOX-REFUND');
  if (!orderId) return;

  process.stdout.write(`\n2. Confirming order (CREATED -> UNPAID)...\n`);
  const confirmed = await adapter.confirmOrder(orderId);
  log('confirmOrder', { confirmed });
  if (!confirmed) {
    process.stdout.write('confirmOrder was rejected — stopping this run.\n');
    return;
  }

  process.stdout.write(`\n3. Simulating payment...\n`);
  const paid = await adapter.simulatePay({ orderId });
  log('simulatePay', { paid });
  if (!paid) {
    process.stdout.write('simulatePay was rejected — stopping this run.\n');
    return;
  }

  // A just-paid order (status 300) is apparently not disputable yet — the
  // first run against this script returned an empty getDisputeProducts
  // right after simulatePay. Push it through the rest of CJ's sandbox
  // ladder (300->400->500->600->700) and attach a tracking number first, on
  // the theory that CJ only opens disputes up once an order has reached a
  // shipped/delivered-equivalent stage — same as the real (non-sandbox)
  // order status list (UNSHIPPED/SHIPPED/DELIVERED).
  process.stdout.write(`\n4. Advancing sandbox order through 400 -> 500 -> 600 -> 700...\n`);
  await adapter.advanceSandboxOrder(orderId, 700);
  process.stdout.write('Advanced to 700.\n');

  process.stdout.write(`\n5. Attaching a tracking number...\n`);
  const tracked = await adapter.updateSandboxTrackNumber({
    orderId,
    trackNumber: `SBX${Date.now()}`,
  });
  log('updateSandboxTrackNumber', { tracked });

  process.stdout.write(`\n6. Order status after advancing...\n`);
  const advancedStatus = await adapter.getOrderStatus(orderId);
  log('getOrderStatus (after advancing)', advancedStatus);

  process.stdout.write(`\n7. Fetching disputable line items (getDisputeProducts)...\n`);
  const disputeProducts = await adapter.getDisputeProducts(orderId);
  log('getDisputeProducts', disputeProducts);
  if (disputeProducts.length === 0) {
    process.stdout.write(
      'CJ still returned no disputable items for this order even at the final sandbox status — ' +
        'either sandbox orders are never dispute-eligible regardless of status, or disputeProducts ' +
        'needs a different param than plain orderId. Stopping here; this by itself is a useful ' +
        'result, not a script failure.\n',
    );
    return;
  }

  const productInfoList = disputeProducts.map((p) => ({
    lineItemId: p.lineItemId,
    quantity: p.quantity,
    price: p.price,
  }));

  process.stdout.write(`\n8. Getting max refundable amount + reasons (getDisputeConfirmInfo)...\n`);
  const confirmInfo = await adapter.getDisputeConfirmInfo(orderId, productInfoList);
  log('getDisputeConfirmInfo', confirmInfo);

  const reasonId = confirmInfo?.disputeReasons?.[0]?.id;
  if (!reasonId) {
    process.stdout.write('No dispute reason codes returned — stopping here.\n');
    return;
  }

  process.stdout.write(`\n9. Filing the dispute (createDispute, reasonId=${reasonId})...\n`);
  const created = await adapter.createDispute({
    orderId,
    businessDisputeId: `TEST-DISPUTE-${Date.now()}`,
    disputeReasonId: reasonId,
    expectType: 1, // refund
    refundType: 1, // balance
    messageText: 'Automated sandbox test dispute — not a real customer complaint.',
    productInfoList,
  });
  log('createDispute', { created });

  process.stdout.write(`\n10. Fetching dispute list for this order...\n`);
  const list = await adapter.getDisputeList({ orderId });
  log('getDisputeList', list);

  const disputeId = list.items[0]?.disputeId;
  if (disputeId) {
    process.stdout.write(`\n11. Fetching dispute detail (disputeId=${disputeId})...\n`);
    const detail = await adapter.getDisputeDetail(disputeId);
    log('getDisputeDetail', detail);
  }

  process.stdout.write(
    created
      ? '\nRefund test: createDispute reported success — check getDisputeDetail above for CJ\'s actual status/decision.\n'
      : '\nRefund test: createDispute reported failure — check the logged responses above for why (a sandbox-order rejection is expected, not a bug).\n',
  );
}

async function main() {
  const query = readFlag('query', 'dress');
  const logisticName = readFlag('logistic', 'CJPacket Ordinary');
  const fromCountryCode = readFlag('fromCountry', 'CN');
  const only = readFlag('only', 'both');

  await redis.connect();
  const adapter = new CJDropshippingAdapter();

  process.stdout.write(`Searching CJ catalog for "${query}"...\n`);
  const { vid } = await findTestVariant(adapter, query);
  process.stdout.write(`Using vid=${vid}\n`);

  if (only === 'cancel' || only === 'both') {
    await testCancel(adapter, vid, logisticName, fromCountryCode);
  }
  if (only === 'refund' || only === 'both') {
    await testRefund(adapter, vid, logisticName, fromCountryCode);
  }

  process.stdout.write('\nDone.\n');
}

main()
  .catch((error) => {
    process.stderr.write(`\nTest failed: ${error instanceof Error ? error.message : error}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await redis.close();
  });
