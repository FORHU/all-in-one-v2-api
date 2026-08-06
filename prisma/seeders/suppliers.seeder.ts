import { PrismaClient } from '@prisma/client';

/**
 * Canonical SupplierPartner IDs. Every other seeder that needs to reference a
 * supplier (imported-products, commerce, payments, etc.) MUST import and use
 * these IDs instead of re-creating/upserting supplier rows themselves — this
 * avoids the historical bug where 'cj-dropshipping' and 'CJ_DROPSHIPPING'
 * ended up as two separate rows due to a case-mismatched unique `name` key.
 */
export const SUPPLIER_IDS = {
  CJ_DROPSHIPPING: '7d890123-4567-4890-a123-456789abcdef',
  PRINTFUL: '8a901234-5678-4901-b234-567890abcdef',
  ALIEXPRESS: '9b012345-6789-4012-c345-678901abcdef',
  PRINTIFY: 'ac123456-7890-4123-d456-789012abcdef',
  SPOCKET: 'bd234567-8901-4234-e567-890123abcdef',
};

export async function seedSuppliers(prisma: PrismaClient) {
  process.stdout.write('🌱 Seeding Supplier Partners...\n');

  const suppliersToSeed = [
    {
      id: SUPPLIER_IDS.CJ_DROPSHIPPING,
      name: 'cj-dropshipping',
      displayName: 'CJ Dropshipping',
      isActive: true,
      config: {
        baseUrl: 'https://developers.cjdropshipping.com/api2.0/v1',
        rateLimitMs: 1500,
      },
    },
    {
      id: SUPPLIER_IDS.PRINTFUL,
      name: 'printful',
      displayName: 'Printful',
      isActive: true,
      config: {
        baseUrl: 'https://api.printful.com',
      },
    },
    {
      id: SUPPLIER_IDS.ALIEXPRESS,
      name: 'aliexpress',
      displayName: 'AliExpress Direct',
      isActive: false,
      config: {},
    },
    {
      id: SUPPLIER_IDS.PRINTIFY,
      name: 'printify',
      displayName: 'Printify',
      isActive: true,
      config: {
        baseUrl: 'https://api.printify.com/v1',
      },
    },
    {
      id: SUPPLIER_IDS.SPOCKET,
      name: 'spocket',
      displayName: 'Spocket',
      isActive: true,
      config: {
        baseUrl: 'https://api.spocket.co',
      },
    },
  ];

  for (const supplier of suppliersToSeed) {
    await prisma.supplierPartner.upsert({
      where: { id: supplier.id },
      update: {
        name: supplier.name,
        displayName: supplier.displayName,
        isActive: supplier.isActive,
        config: supplier.config,
      },
      create: supplier,
    });
    process.stdout.write(`✅ Seeded supplier: ${supplier.displayName}\n`);
  }
}

export default seedSuppliers;
