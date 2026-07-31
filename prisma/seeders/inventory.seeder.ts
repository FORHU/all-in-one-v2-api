import { PrismaClient } from '@prisma/client';
import { TENANT_IDS } from './tenants.seeder';

export async function seedInventory(prisma: PrismaClient) {
  process.stdout.write('🌱 Seeding Multi-Location Inventory & Stock Levels...\n');

  // Create Locations for Fashion & Electronics
  const mainWarehouse = await prisma.inventoryLocation.upsert({
    where: { tenantId_code: { tenantId: TENANT_IDS.FASHION, code: 'WH-MAIN-01' } },
    update: {},
    create: {
      tenantId: TENANT_IDS.FASHION,
      name: 'Main Distribution Center (Fashion)',
      code: 'WH-MAIN-01',
      type: 'WAREHOUSE',
      isPrimary: true,
      isActive: true,
      address: { city: 'Los Angeles', state: 'CA', country: 'US', zip: '90001' },
    },
  });

  const retailStore = await prisma.inventoryLocation.upsert({
    where: { tenantId_code: { tenantId: TENANT_IDS.FASHION, code: 'STORE-LA-01' } },
    update: {},
    create: {
      tenantId: TENANT_IDS.FASHION,
      name: 'Downtown LA Flagship Store',
      code: 'STORE-LA-01',
      type: 'RETAIL_STORE',
      isPrimary: false,
      isActive: true,
      address: { city: 'Los Angeles', state: 'CA', country: 'US', zip: '90015' },
    },
  });

  const techWarehouse = await prisma.inventoryLocation.upsert({
    where: { tenantId_code: { tenantId: TENANT_IDS.ELECTRONICS, code: 'WH-TECH-01' } },
    update: {},
    create: {
      tenantId: TENANT_IDS.ELECTRONICS,
      name: 'Tech Fulfillment Warehouse',
      code: 'WH-TECH-01',
      type: 'WAREHOUSE',
      isPrimary: true,
      isActive: true,
      address: { city: 'Austin', state: 'TX', country: 'US', zip: '73301' },
    },
  });

  // Seed inventory stocks for Fashion variants
  const fashionVariants = await prisma.catalogProductVariant.findMany({
    where: { tenantId: TENANT_IDS.FASHION },
  });

  for (const variant of fashionVariants) {
    await prisma.inventoryStock.upsert({
      where: { variantId_locationId: { variantId: variant.id, locationId: mainWarehouse.id } },
      update: {},
      create: {
        tenantId: TENANT_IDS.FASHION,
        variantId: variant.id,
        locationId: mainWarehouse.id,
        onHand: 150,
        reserved: 5,
        available: 145,
        reorderPoint: 10,
      },
    });

    await prisma.inventoryStock.upsert({
      where: { variantId_locationId: { variantId: variant.id, locationId: retailStore.id } },
      update: {},
      create: {
        tenantId: TENANT_IDS.FASHION,
        variantId: variant.id,
        locationId: retailStore.id,
        onHand: 25,
        reserved: 0,
        available: 25,
        reorderPoint: 5,
      },
    });
  }

  // Seed inventory stocks for Electronics variants
  const techVariants = await prisma.catalogProductVariant.findMany({
    where: { tenantId: TENANT_IDS.ELECTRONICS },
  });

  for (const variant of techVariants) {
    await prisma.inventoryStock.upsert({
      where: { variantId_locationId: { variantId: variant.id, locationId: techWarehouse.id } },
      update: {},
      create: {
        tenantId: TENANT_IDS.ELECTRONICS,
        variantId: variant.id,
        locationId: techWarehouse.id,
        onHand: 80,
        reserved: 2,
        available: 78,
        reorderPoint: 8,
      },
    });
  }

  process.stdout.write('✅ Seeded Multi-Location Inventory & Variant Stock Balances!\n');
}
