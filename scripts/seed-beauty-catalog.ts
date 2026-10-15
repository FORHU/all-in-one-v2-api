import '../src/config';
import { PrismaClient } from '@prisma/client';
import { seedCategories } from '../prisma/seeders/categories.seeder';
import { seedImportedProducts } from '../prisma/seeders/imported-products.seeder';

/**
 * Populates the AskMeBeauty (beauty) tenant's real catalog — categories +
 * products + variants — which the full prisma/seed.ts pipeline has always
 * defined (CATEGORY_TREE_BY_TENANT / CATALOG_DATASET already have complete
 * beauty entries) but never actually run against this dev DB, confirmed via
 * direct query: 0 categories, 0 products for beauty before this script.
 *
 * Deliberately calls just these two seeders rather than the full
 * prisma/seed.ts main() — that also re-runs users/suppliers/inventory/
 * promotions/CMS/payments for all 5 tenants, far more surface than this
 * task needs against a live, actively-used dev database. Both seeders are
 * upsert-based (safe to re-run) and inherently seed all 5 tenants together
 * (that's how they're written, not beauty-specific) — their own effect on
 * fashion/electronics/living/outdoor is additive only (upsert never
 * deletes), matching rows already defined in the same source files.
 */
async function main() {
  const prisma = new PrismaClient();
  try {
    await seedCategories(prisma);
    await seedImportedProducts(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
