/**
 * One-off backfill: re-queues every already-imported supplier product for a
 * fresh sync, so SupplierVariant.stock (and price/attributes/images) gets
 * populated for products imported before that write existed.
 *
 * Requires the API's Postgres and RabbitMQ to be reachable (same env this
 * app normally runs against), and the worker process running separately to
 * actually drain the queue — this script only enqueues the jobs.
 *
 * Usage:
 *   npx ts-node scripts/resync-all-products.ts [--supplier=cj-dropshipping] [--tenant=<slug>]
 *
 * No flags = every supplier, every tenant (same scope as the 6-hourly cron).
 */
import { PrismaClient } from '@prisma/client';
import { rabbitmq } from '../src/infrastructure/rabbitmq';
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

  // This script runs standalone (outside server.ts/worker.ts's own startup),
  // so nothing has connected to RabbitMQ yet — ProductSyncService publishes
  // over the same shared `rabbitmq` singleton the app/worker use, and
  // publish() silently swallows a "not connected" error instead of
  // throwing, so skipping this step looks like success right up until the
  // worker never receives anything.
  await rabbitmq.connect();

  const result = await ProductSyncService.resyncAll({ supplierName, tenantId });

  process.stdout.write(
    `Queued ${result.jobsQueued} job(s) covering ${result.productsQueued} product(s) across ${result.suppliersQueued} supplier(s).\n` +
      'The worker process (npm run worker) must be running to actually process them.\n',
  );
}

main()
  .catch((error) => {
    process.stderr.write(`Resync backfill failed: ${error instanceof Error ? error.message : error}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await rabbitmq.close();
  });
