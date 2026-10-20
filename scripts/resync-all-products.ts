/**
 * One-off backfill: re-queues every already-imported supplier product for a
 * fresh sync, so SupplierVariant.stock (and price/attributes/images) gets
 * populated for products imported before that write existed.
 *
 * Requires the API's Postgres and the product-sync SQS queue to be reachable
 * (same env this app normally runs against — PRODUCT_SYNC_QUEUE_URL, plus
 * AWS_SQS_ENDPOINT locally), and the worker process running separately to
 * actually drain the queue — this script only enqueues the jobs.
 *
 * Usage:
 *   npx ts-node scripts/resync-all-products.ts [--supplier=cj-dropshipping] [--tenant=<slug>]
 *
 * No flags = every supplier, every tenant (same scope as the 6-hourly cron).
 */
import { PrismaClient } from '@prisma/client';
import { ProductSyncService } from '../src/modules/catalog/product-sync.service';

const prisma = new PrismaClient();

function readFlag(name: string): string | undefined {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  return arg ? arg.slice(name.length + 3) : undefined;
}

async function main() {
  const supplierName = readFlag('supplier');
  const tenantSlug = readFlag('tenant');

  let tenantId: string | undefined;
  if (tenantSlug) {
    const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) {
      throw new Error(`No tenant found with slug "${tenantSlug}"`);
    }
    tenantId = tenant.id;
  }

  process.stdout.write(
    `Queuing resync for supplier=${supplierName ?? 'ALL'} tenant=${tenantSlug ?? 'ALL'}...\n`,
  );

  // No connect step needed: SQS is plain HTTPS, and a failed enqueue throws
  // (marking that chunk's Job FAILED), so a misconfigured queue surfaces here
  // instead of looking like success.
  const result = await ProductSyncService.resyncAll({ supplierName, tenantId });

  process.stdout.write(
    `Queued ${result.jobsQueued} job(s) covering ${result.productsQueued} product(s) across ${result.suppliersQueued} supplier(s).\n` +
      'The worker process (npm run worker) must be running to actually process them.\n',
  );
}

main()
  .catch((error) => {
    process.stderr.write(
      `Resync backfill failed: ${error instanceof Error ? error.message : error}\n`,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
