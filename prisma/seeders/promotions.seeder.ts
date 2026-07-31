import { PrismaClient, PromotionStatus } from '@prisma/client';
import { TENANT_IDS } from './tenants.seeder';

export async function seedPromotions(prisma: PrismaClient) {
  process.stdout.write('🌱 Seeding Platform Promotions & Campaign Engine...\n');

  // 1. Fashion Summer Sale Promo
  await prisma.promotion.create({
    data: {
      tenantId: TENANT_IDS.FASHION,
      title: 'Summer 2026 Fashion Campaign (20% OFF)',
      code: 'SUMMER2026',
      description: 'Get 20% OFF all fashion items on orders over $50.',
      status: PromotionStatus.ACTIVE,
      priority: 10,
      startDate: new Date('2026-06-01'),
      endDate: new Date('2026-08-31'),
      usageLimit: 1000,
      usageCount: 42,
      rules: {
        create: [
          {
            ruleType: 'MIN_CART_TOTAL',
            condition: { minTotal: 50, currency: 'USD' },
          },
        ],
      },
      rewards: {
        create: [
          {
            rewardType: 'PERCENTAGE_OFF',
            value: 20.0,
            maxDiscount: 50.0,
          },
        ],
      },
      targets: {
        create: [
          {
            targetType: 'ALL',
          },
        ],
      },
    },
  });

  // 2. Electronics Creator Tech Bundle Promo
  await prisma.promotion.create({
    data: {
      tenantId: TENANT_IDS.ELECTRONICS,
      title: 'Creator Tech Desk Bundle Discount ($100 OFF)',
      code: 'CREATOR100',
      description: '$100 Instant Discount on Creator Workstation bundles.',
      status: PromotionStatus.ACTIVE,
      priority: 5,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      usageLimit: 500,
      rules: {
        create: [
          {
            ruleType: 'MIN_CART_TOTAL',
            condition: { minTotal: 500, currency: 'USD' },
          },
        ],
      },
      rewards: {
        create: [
          {
            rewardType: 'FIXED_AMOUNT_OFF',
            value: 100.0,
          },
        ],
      },
      targets: {
        create: [
          {
            targetType: 'CATEGORY',
          },
        ],
      },
    },
  });

  process.stdout.write('✅ Seeded Platform Promotions, Rules, Rewards & Targets!\n');
}
