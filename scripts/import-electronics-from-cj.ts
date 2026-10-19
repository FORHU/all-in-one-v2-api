/**
 * Bulk-imports real CJ Dropshipping products into the electronics
 * (DigitFriend) catalog — the top N CJ results per DigitFriend category,
 * sourced from that category's mapped CJ categories (or keywords) in
 * src/modules/electronics/electronics.config.ts. Each import is the same
 * ElectronicsSourcingService.importFromCj call POST /v2/electronics/cj/import
 * makes, so pricing follows the electronics tenant's default pricing rule —
 * create/apply one in the admin Pricing page first, or products import at
 * raw CJ cost.
 *
 * Runs here rather than as one HTTP request: every import makes several
 * rate-limited CJ calls (product detail + one stock lookup per variant).
 *
 * Needs the API's Postgres, Redis (CJ token cache) and CJ_API_KEY.
 *
 * Usage:
 *   npm run electronics:import -- [--per-category=5] [--category=audio] [--apply]
 *
 * Without --apply it's a dry run: searches CJ and lists what it would import.
 */
import { prisma } from '../src/utils/prisma';
import { redis } from '../src/infrastructure/redis';
import { registerSuppliers } from '../src/suppliers';
import { ElectronicsSourcingService } from '../src/modules/electronics/electronics-sourcing.service';
import {
  ELECTRONICS_CATEGORY_SLUGS,
  ELECTRONICS_CJ_SOURCES,
  ElectronicsCategorySlug,
} from '../src/modules/electronics/electronics.config';

function readFlag(name: string): string | undefined {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  return arg ? arg.slice(name.length + 3) : undefined;
}

const log = (line: string) => process.stdout.write(`${line}\n`);

type Candidate = { id: string; title: string; price: unknown };

/** Up to `count` not-yet-imported CJ products, walking the category's CJ ids (or keywords) in order. */
async function findCandidates(slug: ElectronicsCategorySlug, count: number): Promise<Candidate[]> {
  const source = ELECTRONICS_CJ_SOURCES[slug];
  const searches: { cjCategoryId?: string; q?: string }[] = [
    ...source.cjCategoryIds.map((cjCategoryId: string) => ({ cjCategoryId })),
    ...source.keywords.map((q: string) => ({ q })),
  ];

  const picked = new Map<string, Candidate>();
  for (const search of searches) {
    if (picked.size >= count) break;
    const result = await ElectronicsSourcingService.searchCj({
      categorySlug: slug,
      ...search,
      page: 1,
      // Over-fetch: some results are already imported.
      limit: Math.min(count * 2, 50),
    });
    for (const item of result.items) {
      if (picked.size >= count) break;
      if (item.alreadyImported || typeof item.id !== 'string' || picked.has(item.id)) continue;
      picked.set(item.id, { id: item.id, title: String(item.nameEn ?? ''), price: item.sellPrice });
    }
  }
  return [...picked.values()];
}

async function main() {
  const perCategory = Number(readFlag('per-category') ?? 5);
  const onlyCategory = readFlag('category');
  const apply = process.argv.includes('--apply');

  if (!Number.isInteger(perCategory) || perCategory < 1 || perCategory > 25) {
    throw new Error('--per-category must be a whole number from 1 to 25');
  }
  if (
    onlyCategory &&
    !ELECTRONICS_CATEGORY_SLUGS.includes(onlyCategory as ElectronicsCategorySlug)
  ) {
    throw new Error(`--category must be one of: ${ELECTRONICS_CATEGORY_SLUGS.join(', ')}`);
  }
  const slugs = onlyCategory
    ? [onlyCategory as ElectronicsCategorySlug]
    : ELECTRONICS_CATEGORY_SLUGS;

  await redis.connect();
  registerSuppliers();
  await ElectronicsSourcingService.getElectronicsTenant();

  log(`${apply ? 'Importing' : 'DRY RUN —'} up to ${perCategory} CJ product(s) per category`);

  let imported = 0;
  let failed = 0;
  for (const slug of slugs) {
    log(`\n[${slug}]`);
    const candidates = await findCandidates(slug, perCategory);
    if (candidates.length === 0) log('  (no new CJ products found)');

    for (const c of candidates) {
      if (!apply) {
        log(`  would import ${c.id}  CJ $${c.price}  ${c.title}`);
        continue;
      }
      try {
        const product = await ElectronicsSourcingService.importFromCj(c.id, slug);
        imported++;
        log(`  ✓ ${product.title}  →  $${product.price}  (CJ $${c.price})`);
      } catch (error) {
        failed++;
        const message = (error as { message?: string })?.message ?? String(error);
        log(`  ✗ ${c.id}  ${c.title}: ${message}`);
      }
    }
  }

  log(
    apply
      ? `\nDone: ${imported} imported, ${failed} failed.`
      : '\nDry run only — rerun with --apply to import.',
  );
}

main()
  .catch((error) => {
    process.stderr.write(
      `Electronics import failed: ${(error as { message?: string })?.message ?? error}\n`,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await redis.close().catch(() => undefined);
    await prisma.$disconnect();
  });
