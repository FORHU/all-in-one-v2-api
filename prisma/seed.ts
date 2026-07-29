import { PrismaClient } from '@prisma/client';
import { seedUsers } from './seeders/users.seeder';
import { seedTenants } from './seeders/tenants.seeder';
import { seedCategories } from './seeders/categories.seeder';
import { seedCommerce } from './seeders/commerce.seeder';
import { seedPayments } from './seeders/payments.seeder';

const prisma = new PrismaClient();

async function main() {
  process.stdout.write('🌱 Starting modular database seeding...\n');

  try {
    await seedUsers(prisma);
    await seedTenants(prisma);
    await seedCategories(prisma);
    await seedCommerce(prisma);
    await seedPayments(prisma);
    process.stdout.write('🎉 All seeder modules executed successfully!\n');
  } catch (error) {
    process.stderr.write(`❌ Seeding failed: ${error}\n`);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
