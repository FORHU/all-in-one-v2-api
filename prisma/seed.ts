import { PrismaClient } from '@prisma/client';
import { seedUsers } from './seeders/users.seeder';

const prisma = new PrismaClient();

async function main() {
  process.stdout.write('🌱 Starting modular database seeding...\n');

  try {
    await seedUsers(prisma);
    process.stdout.write('🎉 All seeder modules executed successfully!\n');
  } catch (error) {
    process.stderr.write(`❌ Seeding failed: ${error}\n`);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
