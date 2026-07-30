import { PrismaClient } from '@prisma/client';
import { TENANT_IDS } from './tenants.seeder';

interface CategoryNode {
  name: string;
  slug: string;
  children?: CategoryNode[];
}

const CATEGORY_TREE_BY_TENANT: Record<string, CategoryNode[]> = {
  [TENANT_IDS.ELECTRONICS]: [
    {
      name: 'Computer Peripherals',
      slug: 'computer-peripherals',
      children: [
        {
          name: 'Mice & Keyboards',
          slug: 'mice-keyboards',
          children: [
            { name: 'Mechanical Keyboards', slug: 'mechanical-keyboards' },
            { name: 'Wireless Gaming Mice', slug: 'wireless-gaming-mice' },
          ],
        },
        { name: 'Monitors & Displays', slug: 'monitors-displays' },
      ],
    },
    {
      name: 'Audio & Sound',
      slug: 'audio-sound',
      children: [
        { name: 'Headphones', slug: 'headphones' },
        { name: 'Bluetooth Speakers', slug: 'bluetooth-speakers' },
      ],
    },
    { name: 'Gaming Accessories', slug: 'gaming-accessories' },
    { name: 'Cameras & Optics', slug: 'cameras-optics' },
  ],
  [TENANT_IDS.FASHION]: [
    {
      name: "Men's Fashion",
      slug: 'mens-fashion',
      children: [
        { name: 'Footwear', slug: 'mens-footwear' },
        { name: 'Apparel', slug: 'mens-apparel' },
      ],
    },
    {
      name: "Women's Fashion",
      slug: 'womens-fashion',
      children: [
        { name: 'Dresses', slug: 'womens-dresses' },
        { name: 'Handbags', slug: 'womens-handbags' },
      ],
    },
  ],
  [TENANT_IDS.BEAUTY]: [
    { name: 'Skincare Tools', slug: 'skincare-tools' },
    { name: 'Cosmetics', slug: 'cosmetics' },
  ],
  [TENANT_IDS.HOME_GARDEN]: [
    { name: 'Home Decor', slug: 'home-decor' },
    { name: 'Lighting', slug: 'lighting' },
  ],
  [TENANT_IDS.HEALTH_WELLNESS]: [
    { name: 'Wearables', slug: 'wearables' },
    { name: 'Fitness Equipment', slug: 'fitness-equipment' },
  ],
  [TENANT_IDS.SPORTS_OUTDOORS]: [
    { name: 'Outdoor Gear', slug: 'outdoor-gear' },
    { name: 'Camping', slug: 'camping' },
  ],
};

async function seedCategoryBranch(
  prisma: PrismaClient,
  tenantId: string,
  node: CategoryNode,
  parentId?: string,
  parentSlug?: string,
) {
  const currentSlug = parentSlug ? `${parentSlug}-${node.slug}` : node.slug;

  const category = await prisma.catalogCategory.upsert({
    where: { tenantId_slug: { tenantId, slug: currentSlug } },
    update: { name: node.name, parentId },
    create: {
      tenantId,
      name: node.name,
      slug: currentSlug,
      parentId,
    },
  });

  if (node.children && node.children.length > 0) {
    for (const child of node.children) {
      await seedCategoryBranch(prisma, tenantId, child, category.id, currentSlug);
    }
  }
}

export async function seedCategories(prisma: PrismaClient) {
  process.stdout.write('🌱 Seeding Deep Enterprise Master Category Taxonomy (Up to 4 Levels)...\n');

  for (const [tenantId, categories] of Object.entries(CATEGORY_TREE_BY_TENANT)) {
    for (const rootCategory of categories) {
      await seedCategoryBranch(prisma, tenantId, rootCategory);
    }
  }

  process.stdout.write(
    '🎉 Ultra-Comprehensive Marketplace Category Tree Seeded Successfully across all Tenants!\n',
  );
}

export default seedCategories;
