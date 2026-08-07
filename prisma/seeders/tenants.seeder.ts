import { PrismaClient, TenantStatus } from '@prisma/client';

export const TENANT_IDS = {
  FASHION: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  BEAUTY: 'c9bf9e57-1685-4c89-bafb-ff5af830be8a',
  ELECTRONICS: 'a3b89012-9c42-4f1b-8521-729909289f01',
  LIVING: 'd1122334-5566-4778-8899-00aabbccdde1',
  OUTDOOR: 'e2233445-6677-4889-9900-11bbccddeeff',
};

export async function seedTenants(prisma: PrismaClient) {
  process.stdout.write('🌱 Seeding 5 Production Storefront Tenants...\n');

  const tenants = [
    {
      id: TENANT_IDS.FASHION,
      name: 'AddictStyle',
      slug: 'fashion',
      domain: 'addictstyle.com',
      status: TenantStatus.ACTIVE,
      settings: { theme: 'dark', currency: 'USD', defaultLanguage: 'en' },
    },
    {
      id: TENANT_IDS.BEAUTY,
      name: 'AskMeBeauty',
      slug: 'beauty',
      domain: 'askmebeauty.com',
      status: TenantStatus.ACTIVE,
      settings: { theme: 'light', currency: 'USD', defaultLanguage: 'en' },
    },
    {
      id: TENANT_IDS.ELECTRONICS,
      name: 'DigitFriend',
      slug: 'electronics',
      domain: 'digitfriend.com',
      status: TenantStatus.ACTIVE,
      settings: { theme: 'dark', currency: 'USD', defaultLanguage: 'en' },
    },
    {
      id: TENANT_IDS.LIVING,
      name: 'Living',
      slug: 'living',
      domain: 'living.com',
      status: TenantStatus.ACTIVE,
      settings: { theme: 'light', currency: 'USD', defaultLanguage: 'en' },
    },
    {
      id: TENANT_IDS.OUTDOOR,
      name: 'Outdoor',
      slug: 'outdoor',
      domain: 'outdoor.com',
      status: TenantStatus.ACTIVE,
      settings: { theme: 'dark', currency: 'USD', defaultLanguage: 'en' },
    },
  ];

  for (const tenantData of tenants) {
    const tenant = await prisma.tenant.upsert({
      where: { id: tenantData.id },
      update: tenantData,
      create: tenantData,
    });
    process.stdout.write(`✅ Seeded Tenant [${tenant.slug}]: ${tenant.name} (${tenant.domain})\n`);
  }
}
