import { PrismaClient } from '@prisma/client';
import { seedUsers } from './seeders/users.seeder';
import { seedTenants } from './seeders/tenants.seeder';
import { seedCategories } from './seeders/categories.seeder';
import { seedCommerce } from './seeders/commerce.seeder';
import { seedPayments } from './seeders/payments.seeder';
import { seedImportedProducts } from './seeders/imported-products.seeder';
import { seedAttributes } from './seeders/attributes.seeder';
import { seedSizeGuides } from './seeders/size-guides.seeder';
import { seedCollections } from './seeders/collections.seeder';
import { seedStorefront } from './seeders/storefront.seeder';
import { seedPromotions } from './seeders/promotions.seeder';
import { seedInventory } from './seeders/inventory.seeder';
import { seedCMS } from './seeders/cms.seeder';
import { seedSuppliers } from './seeders/suppliers.seeder';

const prisma = new PrismaClient();

async function main() {
  process.stdout.write('🌱 Starting modular database seeding in all-in-one-v2-api...\n');

  try {
    await seedUsers(prisma);
    await seedTenants(prisma);
    await seedCategories(prisma);
    await seedSuppliers(prisma);
    await seedImportedProducts(prisma);
    await seedAttributes(prisma);
    await seedSizeGuides(prisma);
    await seedCollections(prisma);
    await seedStorefront(prisma);
    await seedPromotions(prisma);
    await seedInventory(prisma);
    await seedCMS(prisma);
    await seedCommerce(prisma);
    await seedPayments(prisma);
    process.stdout.write('🎉 All seeder modules executed successfully in v2-api!\n');
  } catch (error) {
    process.stderr.write(`❌ Seeding failed: ${error}\n`);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
