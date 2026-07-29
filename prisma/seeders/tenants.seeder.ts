import { PrismaClient, TenantStatus } from '@prisma/client';

export const TENANT_IDS = {
  FASHION: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  ELECTRONICS: 'a3b89012-9c42-4f1b-8521-729909289f01',
  AUTOMOBILES: 'b9876543-1234-4567-8901-23456789abcd',
  BEAUTY: 'c9bf9e57-1685-4c89-bafb-ff5af830be8a',
  HOME_GARDEN: 'd1122334-5566-4778-8899-00aabbccdde1',
  SPORTS_OUTDOORS: 'e2233445-6677-4889-9900-11bbccddeeff',
  TOYS_KIDS: 'f3344556-7788-4990-0011-22ccddeeff00',
  HEALTH_WELLNESS: 'a4455667-8899-4001-1122-33ddeeff0011',
  GROCERIES: 'b5566778-9900-4112-2233-44eeff001122',
  PET_SUPPLIES: 'c6677889-0011-4223-3344-55ff00112233',
};

export async function seedTenants(prisma: PrismaClient) {
  process.stdout.write('🌱 Seeding 10 Legit Storefront Verticals (Tenants)...\n');

  const tenants = [
    {
      id: TENANT_IDS.FASHION,
      name: 'Vogue Fashion Store',
      slug: 'fashion',
      domain: 'fashion.localhost',
      status: TenantStatus.ACTIVE,
      settings: { theme: 'dark', currency: 'USD', defaultLanguage: 'en' },
    },
    {
      id: TENANT_IDS.ELECTRONICS,
      name: 'Pulse Electronics & Tech Store',
      slug: 'electronics',
      domain: 'electronics.localhost',
      status: TenantStatus.ACTIVE,
      settings: { theme: 'dark', currency: 'USD', defaultLanguage: 'en' },
    },
    {
      id: TENANT_IDS.AUTOMOBILES,
      name: 'Apex Auto & Motorcycle Store',
      slug: 'automobiles',
      domain: 'automobiles.localhost',
      status: TenantStatus.ACTIVE,
      settings: { theme: 'dark', currency: 'USD', defaultLanguage: 'en' },
    },
    {
      id: TENANT_IDS.BEAUTY,
      name: 'Glow Beauty & Skincare Store',
      slug: 'beauty',
      domain: 'beauty.localhost',
      status: TenantStatus.ACTIVE,
      settings: { theme: 'light', currency: 'USD', defaultLanguage: 'en' },
    },
    {
      id: TENANT_IDS.HOME_GARDEN,
      name: 'Haven Home & Living Store',
      slug: 'home-garden',
      domain: 'home-garden.localhost',
      status: TenantStatus.ACTIVE,
      settings: { theme: 'light', currency: 'USD', defaultLanguage: 'en' },
    },
    {
      id: TENANT_IDS.SPORTS_OUTDOORS,
      name: 'Titan Sports & Outdoor Gear',
      slug: 'sports-outdoors',
      domain: 'sports-outdoors.localhost',
      status: TenantStatus.ACTIVE,
      settings: { theme: 'dark', currency: 'USD', defaultLanguage: 'en' },
    },
    {
      id: TENANT_IDS.TOYS_KIDS,
      name: 'Wonder Toys & Kids Store',
      slug: 'toys-kids',
      domain: 'toys-kids.localhost',
      status: TenantStatus.ACTIVE,
      settings: { theme: 'light', currency: 'USD', defaultLanguage: 'en' },
    },
    {
      id: TENANT_IDS.HEALTH_WELLNESS,
      name: 'Vitality Health & Wellness',
      slug: 'health-wellness',
      domain: 'health-wellness.localhost',
      status: TenantStatus.ACTIVE,
      settings: { theme: 'light', currency: 'USD', defaultLanguage: 'en' },
    },
    {
      id: TENANT_IDS.GROCERIES,
      name: 'Artisan Gourmet Groceries',
      slug: 'groceries',
      domain: 'groceries.localhost',
      status: TenantStatus.ACTIVE,
      settings: { theme: 'light', currency: 'USD', defaultLanguage: 'en' },
    },
    {
      id: TENANT_IDS.PET_SUPPLIES,
      name: 'Paws & Claws Pet Supplies',
      slug: 'pet-supplies',
      domain: 'pet-supplies.localhost',
      status: TenantStatus.ACTIVE,
      settings: { theme: 'light', currency: 'USD', defaultLanguage: 'en' },
    },
  ];

  for (const tenantData of tenants) {
    const existing = await prisma.tenant.findUnique({
      where: { id: tenantData.id },
    });

    if (!existing) {
      await prisma.tenant.create({
        data: tenantData,
      });
      process.stdout.write(`✅ Created Tenant [${tenantData.slug}]: ${tenantData.name}\n`);
    } else {
      process.stdout.write(`ℹ️ Tenant already exists: ${tenantData.slug}\n`);
    }
  }
}
