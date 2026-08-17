import { PrismaClient } from '@prisma/client';
import { seedSuppliers } from './seeders/suppliers.seeder';

const prisma = new PrismaClient();

seedSuppliers(prisma)
  .then(() => process.stdout.write('🎉 Suppliers seeded.\n'))
  .catch((error) => {
    process.stderr.write(`❌ Seeding suppliers failed: ${error}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
