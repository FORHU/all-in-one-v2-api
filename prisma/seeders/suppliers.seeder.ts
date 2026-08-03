import { PrismaClient } from '@prisma/client';

export async function seedSuppliers(prisma: PrismaClient) {
  process.stdout.write('🌱 Seeding Supplier Partners...\n');

  const suppliersToSeed = [
    {
      name: 'cj-dropshipping',
      displayName: 'CJ Dropshipping',
      isActive: true,
      config: {
        baseUrl: 'https://developers.cjdropshipping.com/api2.0/v1',
      },
    },
    {
      name: 'printful',
      displayName: 'Printful',
      isActive: true,
      config: {
        baseUrl: 'https://api.printful.com',
      },
    },
    {
      name: 'aliexpress',
      displayName: 'AliExpress',
      isActive: false,
      config: {},
    },
  ];

  for (const supplier of suppliersToSeed) {
    const existingSupplier = await prisma.supplierPartner.findUnique({
      where: { name: supplier.name },
    });

    if (existingSupplier) {
      process.stdout.write(`ℹ️  Supplier already exists: ${supplier.displayName}\n`);
    } else {
      await prisma.supplierPartner.create({
        data: supplier,
      });
      process.stdout.write(`✅ Created supplier: ${supplier.displayName}\n`);
    }
  }
}

export default seedSuppliers;
