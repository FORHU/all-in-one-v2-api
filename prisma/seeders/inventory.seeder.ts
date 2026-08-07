import { PrismaClient } from '@prisma/client';
import { TENANT_IDS } from './tenants.seeder';

interface LocationSeed {
  name: string;
  code: string;
  type: string;
  isPrimary: boolean;
  address: Record<string, string>;
}

const LOCATIONS_BY_TENANT: Record<string, LocationSeed[]> = {
  [TENANT_IDS.FASHION]: [
    {
      name: 'Main Distribution Center (Fashion)',
      code: 'WH-MAIN-01',
      type: 'WAREHOUSE',
      isPrimary: true,
      address: { city: 'Los Angeles', state: 'CA', country: 'US', zip: '90001' },
    },
    {
      name: 'Regional East Warehouse',
      code: 'WH-EAST-01',
      type: 'WAREHOUSE',
      isPrimary: false,
      address: { city: 'Newark', state: 'NJ', country: 'US', zip: '07102' },
    },
    {
      name: 'Downtown LA Flagship Store',
      code: 'STORE-LA-01',
      type: 'RETAIL_STORE',
      isPrimary: false,
      address: { city: 'Los Angeles', state: 'CA', country: 'US', zip: '90015' },
    },
    {
      name: 'SoHo Pop-up Store',
      code: 'STORE-SOHO-01',
      type: 'RETAIL_STORE',
      isPrimary: false,
      address: { city: 'New York', state: 'NY', country: 'US', zip: '10012' },
    },
    {
      name: 'Returns Processing Center',
      code: 'WH-RET-01',
      type: 'WAREHOUSE',
      isPrimary: false,
      address: { city: 'Ontario', state: 'CA', country: 'US', zip: '91761' },
    },
  ],
  [TENANT_IDS.BEAUTY]: [
    {
      name: 'Main Fulfillment Center (Beauty)',
      code: 'WH-MAIN-01',
      type: 'WAREHOUSE',
      isPrimary: true,
      address: { city: 'Miami', state: 'FL', country: 'US', zip: '33101' },
    },
    {
      name: 'Regional West Warehouse',
      code: 'WH-WEST-01',
      type: 'WAREHOUSE',
      isPrimary: false,
      address: { city: 'Las Vegas', state: 'NV', country: 'US', zip: '89101' },
    },
    {
      name: 'South Beach Flagship Store',
      code: 'STORE-MIA-01',
      type: 'RETAIL_STORE',
      isPrimary: false,
      address: { city: 'Miami', state: 'FL', country: 'US', zip: '33139' },
    },
    {
      name: 'Mall Kiosk Store',
      code: 'STORE-KIOSK-01',
      type: 'RETAIL_STORE',
      isPrimary: false,
      address: { city: 'Orlando', state: 'FL', country: 'US', zip: '32819' },
    },
    {
      name: 'Returns Processing Center',
      code: 'WH-RET-01',
      type: 'WAREHOUSE',
      isPrimary: false,
      address: { city: 'Tampa', state: 'FL', country: 'US', zip: '33602' },
    },
  ],
  [TENANT_IDS.ELECTRONICS]: [
    {
      name: 'Tech Fulfillment Warehouse',
      code: 'WH-TECH-01',
      type: 'WAREHOUSE',
      isPrimary: true,
      address: { city: 'Austin', state: 'TX', country: 'US', zip: '73301' },
    },
    {
      name: 'Regional North Warehouse',
      code: 'WH-NORTH-01',
      type: 'WAREHOUSE',
      isPrimary: false,
      address: { city: 'Chicago', state: 'IL', country: 'US', zip: '60601' },
    },
    {
      name: 'Austin Flagship Store',
      code: 'STORE-ATX-01',
      type: 'RETAIL_STORE',
      isPrimary: false,
      address: { city: 'Austin', state: 'TX', country: 'US', zip: '78701' },
    },
    {
      name: 'Tech Mall Demo Store',
      code: 'STORE-DEMO-01',
      type: 'RETAIL_STORE',
      isPrimary: false,
      address: { city: 'San Jose', state: 'CA', country: 'US', zip: '95110' },
    },
    {
      name: 'Returns & RMA Center',
      code: 'WH-RET-01',
      type: 'WAREHOUSE',
      isPrimary: false,
      address: { city: 'Dallas', state: 'TX', country: 'US', zip: '75201' },
    },
  ],
  [TENANT_IDS.LIVING]: [
    {
      name: 'Main Distribution Warehouse (Living)',
      code: 'WH-MAIN-01',
      type: 'WAREHOUSE',
      isPrimary: true,
      address: { city: 'Portland', state: 'OR', country: 'US', zip: '97201' },
    },
    {
      name: 'Regional South Warehouse',
      code: 'WH-SOUTH-01',
      type: 'WAREHOUSE',
      isPrimary: false,
      address: { city: 'Atlanta', state: 'GA', country: 'US', zip: '30301' },
    },
    {
      name: 'Portland Showroom',
      code: 'STORE-PDX-01',
      type: 'RETAIL_STORE',
      isPrimary: false,
      address: { city: 'Portland', state: 'OR', country: 'US', zip: '97205' },
    },
    {
      name: 'Design District Pop-up Store',
      code: 'STORE-DESIGN-01',
      type: 'RETAIL_STORE',
      isPrimary: false,
      address: { city: 'Seattle', state: 'WA', country: 'US', zip: '98101' },
    },
    {
      name: 'Returns Processing Center',
      code: 'WH-RET-01',
      type: 'WAREHOUSE',
      isPrimary: false,
      address: { city: 'Sacramento', state: 'CA', country: 'US', zip: '95814' },
    },
  ],
  [TENANT_IDS.OUTDOOR]: [
    {
      name: 'Main Distribution Warehouse (Outdoor)',
      code: 'WH-MAIN-01',
      type: 'WAREHOUSE',
      isPrimary: true,
      address: { city: 'Denver', state: 'CO', country: 'US', zip: '80201' },
    },
    {
      name: 'Regional Mountain Warehouse',
      code: 'WH-MTN-01',
      type: 'WAREHOUSE',
      isPrimary: false,
      address: { city: 'Salt Lake City', state: 'UT', country: 'US', zip: '84101' },
    },
    {
      name: 'Denver Flagship Store',
      code: 'STORE-DEN-01',
      type: 'RETAIL_STORE',
      isPrimary: false,
      address: { city: 'Denver', state: 'CO', country: 'US', zip: '80202' },
    },
    {
      name: 'Trailhead Pop-up Store',
      code: 'STORE-TRAIL-01',
      type: 'RETAIL_STORE',
      isPrimary: false,
      address: { city: 'Boulder', state: 'CO', country: 'US', zip: '80301' },
    },
    {
      name: 'Returns Processing Center',
      code: 'WH-RET-01',
      type: 'WAREHOUSE',
      isPrimary: false,
      address: { city: 'Colorado Springs', state: 'CO', country: 'US', zip: '80903' },
    },
  ],
};

export async function seedInventory(prisma: PrismaClient) {
  process.stdout.write('🌱 Seeding Multi-Location Inventory & Stock Levels for 5 Tenants...\n');

  for (const [tenantId, locationDefs] of Object.entries(LOCATIONS_BY_TENANT)) {
    const locations = [];
    for (const loc of locationDefs) {
      const location = await prisma.inventoryLocation.upsert({
        where: { tenantId_code: { tenantId, code: loc.code } },
        update: {},
        create: {
          tenantId,
          name: loc.name,
          code: loc.code,
          type: loc.type,
          isPrimary: loc.isPrimary,
          isActive: true,
          address: loc.address,
        },
      });
      locations.push(location);
    }

    const [primaryWarehouse, regionalWarehouse, flagshipStore, popupStore] = locations;

    const variants = await prisma.catalogProductVariant.findMany({ where: { tenantId } });

    for (let i = 0; i < variants.length; i++) {
      const variant = variants[i];
      const baseStock = variant.stock || 100;

      // Primary warehouse holds the majority of stock for every variant
      await prisma.inventoryStock.upsert({
        where: { variantId_locationId: { variantId: variant.id, locationId: primaryWarehouse.id } },
        update: {},
        create: {
          tenantId,
          variantId: variant.id,
          locationId: primaryWarehouse.id,
          onHand: baseStock,
          reserved: Math.round(baseStock * 0.03),
          available: baseStock - Math.round(baseStock * 0.03),
          reorderPoint: 10,
        },
      });

      // Regional warehouse holds overflow stock for every variant
      const regionalStock = Math.max(10, Math.round(baseStock * 0.4));
      await prisma.inventoryStock.upsert({
        where: {
          variantId_locationId: { variantId: variant.id, locationId: regionalWarehouse.id },
        },
        update: {},
        create: {
          tenantId,
          variantId: variant.id,
          locationId: regionalWarehouse.id,
          onHand: regionalStock,
          reserved: 0,
          available: regionalStock,
          reorderPoint: 5,
        },
      });

      // Flagship retail store carries a curated subset (first 4 variants)
      if (i < 4) {
        await prisma.inventoryStock.upsert({
          where: { variantId_locationId: { variantId: variant.id, locationId: flagshipStore.id } },
          update: {},
          create: {
            tenantId,
            variantId: variant.id,
            locationId: flagshipStore.id,
            onHand: 25,
            reserved: 0,
            available: 25,
            reorderPoint: 5,
          },
        });
      }

      // Pop-up store carries a small curated subset (first 2 variants)
      if (i < 2) {
        await prisma.inventoryStock.upsert({
          where: { variantId_locationId: { variantId: variant.id, locationId: popupStore.id } },
          update: {},
          create: {
            tenantId,
            variantId: variant.id,
            locationId: popupStore.id,
            onHand: 10,
            reserved: 0,
            available: 10,
            reorderPoint: 3,
          },
        });
      }
    }
  }

  process.stdout.write(
    '✅ Seeded Multi-Location Inventory & Variant Stock Balances for all tenants!\n',
  );
}

export default seedInventory;
