import { PrismaClient } from '@prisma/client';
import { TENANT_IDS } from './tenants.seeder';

interface CategoryNode {
  name: string;
  slug: string;
  description?: string;
  children?: CategoryNode[];
}

const CATEGORY_TREE_BY_TENANT: Record<string, CategoryNode[]> = {
  [TENANT_IDS.FASHION]: [
    {
      name: "Men's Fashion",
      slug: 'mens-fashion',
      description: 'Everyday and statement pieces for men.',
    },
    {
      name: "Women's Fashion",
      slug: 'womens-fashion',
      description: 'Dresses, separates and going-out looks for women.',
    },
    {
      name: 'Footwear',
      slug: 'footwear',
      description: 'Sneakers, boots and everyday shoes.',
    },
    {
      name: 'Shoes',
      slug: 'shoes',
      description: 'Dress shoes, heels, loafers and formal footwear.',
    },
    {
      name: 'Outerwear',
      slug: 'outerwear',
      description: 'Hoodies, jackets and layering pieces.',
    },
    {
      name: 'Accessories',
      slug: 'accessories',
      description: 'Caps, belts and finishing touches.',
    },
    {
      name: 'Bags & Backpacks',
      slug: 'bags',
      description: 'Crossbody, tote and everyday carry bags.',
    },
    {
      name: 'Kids',
      slug: 'kids',
      description: 'Everyday and playtime essentials for kids.',
    },
  ],
  [TENANT_IDS.BEAUTY]: [
    { name: 'Skincare', slug: 'skincare', description: 'Serums, moisturizers and treatments.' },
    { name: 'Makeup & Cosmetics', slug: 'makeup', description: 'Color cosmetics and complexion.' },
    { name: 'Hair Care', slug: 'haircare', description: 'Styling tools and hair treatments.' },
    { name: 'Fragrance', slug: 'fragrance', description: 'Eau de parfum and eau de toilette.' },
    {
      name: 'Beauty Tools & Devices',
      slug: 'tools-devices',
      description: 'Cleansing and skincare devices.',
    },
    { name: 'Bath & Body', slug: 'bath-body', description: 'Body butters, washes and scrubs.' },
  ],
  [TENANT_IDS.ELECTRONICS]: [
    {
      name: 'Computer Peripherals',
      slug: 'computer-peripherals',
      description: 'Keyboards, mice and desk accessories.',
    },
    { name: 'Audio & Sound', slug: 'audio', description: 'Headphones and speakers.' },
    {
      name: 'Gaming Accessories',
      slug: 'gaming-accessories',
      description: 'Gear for competitive and casual gaming.',
    },
    {
      name: 'Cameras & Optics',
      slug: 'cameras-optics',
      description: 'Webcams and streaming video gear.',
    },
    { name: 'Smart Home', slug: 'smart-home', description: 'Connected home devices and hubs.' },
    {
      name: 'Wearable Tech',
      slug: 'wearable-tech',
      description: 'Smartwatches and fitness wearables.',
    },
  ],
  [TENANT_IDS.LIVING]: [
    { name: 'Home Decor', slug: 'home-decor', description: 'Rugs, art and decorative accents.' },
    { name: 'Lighting', slug: 'lighting', description: 'Lamps and ambient lighting.' },
    { name: 'Furniture', slug: 'furniture', description: 'Seating, tables and storage furniture.' },
    {
      name: 'Kitchen & Dining',
      slug: 'kitchen-dining',
      description: 'Dinnerware and dining essentials.',
    },
    {
      name: 'Bedding & Bath',
      slug: 'bedding-bath',
      description: 'Sheets, towels and bath linens.',
    },
    {
      name: 'Storage & Organization',
      slug: 'storage-organization',
      description: 'Shelving and organizational furniture.',
    },
  ],
  [TENANT_IDS.OUTDOOR]: [
    {
      name: 'Camping & Hiking',
      slug: 'camping-hiking',
      description: 'Tents, packs and trail gear.',
    },
    { name: 'Yoga & Fitness', slug: 'yoga-fitness', description: 'Mats and outdoor fitness gear.' },
    { name: 'Cycling', slug: 'cycling', description: 'Apparel and accessories for riders.' },
    {
      name: 'Water Sports',
      slug: 'water-sports',
      description: 'Paddleboards and water gear.',
    },
    {
      name: 'Outdoor Apparel',
      slug: 'outdoor-apparel',
      description: 'Technical clothing for the outdoors.',
    },
    {
      name: 'Hydration & Gear',
      slug: 'hydration-gear',
      description: 'Bottles, hydration packs and trail accessories.',
    },
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
    update: { name: node.name, parentId, description: node.description },
    create: {
      tenantId,
      name: node.name,
      slug: currentSlug,
      parentId,
      description: node.description,
    },
  });

  if (node.children && node.children.length > 0) {
    for (const child of node.children) {
      await seedCategoryBranch(prisma, tenantId, child, category.id, currentSlug);
    }
  }
}

export async function seedCategories(prisma: PrismaClient) {
  process.stdout.write('🌱 Seeding Master Category Taxonomy across 5 Tenants...\n');

  for (const [tenantId, categories] of Object.entries(CATEGORY_TREE_BY_TENANT)) {
    for (const rootCategory of categories) {
      await seedCategoryBranch(prisma, tenantId, rootCategory);
    }
  }

  process.stdout.write('🎉 Category Taxonomy Seeded Successfully across all Tenants!\n');
}

export default seedCategories;
