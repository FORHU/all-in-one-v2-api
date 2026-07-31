import { PrismaClient } from '@prisma/client';
import { TENANT_IDS } from './tenants.seeder';

export async function seedCollections(prisma: PrismaClient) {
  process.stdout.write('🌱 Seeding Catalog Collections & Lookbooks...\n');

  // Fetch products for linking
  const fashionProducts = await prisma.catalogProduct.findMany({
    where: { tenantId: TENANT_IDS.FASHION },
    include: { variants: true },
    take: 4,
  });

  const techProducts = await prisma.catalogProduct.findMany({
    where: { tenantId: TENANT_IDS.ELECTRONICS },
    include: { variants: true },
    take: 4,
  });

  // 1. Fashion Parent Lookbook
  const parentLookbook = await prisma.catalogCollection.upsert({
    where: {
      tenantId_slug: { tenantId: TENANT_IDS.FASHION, slug: 'urban-streetwear-lookbook-2026' },
    },
    update: {},
    create: {
      tenantId: TENANT_IDS.FASHION,
      title: 'Urban Streetwear Lookbook 2026',
      slug: 'urban-streetwear-lookbook-2026',
      type: 'LOOKBOOK',
      description: 'Curated summer streetwear fits designed for everyday comfort.',
      metadata: { season: 'Summer 2026', style: 'Streetwear / Oversized' },
      isPublic: true,
    },
  });

  // 2. Fashion Sub-Collection (Outfit)
  const outfitCollection = await prisma.catalogCollection.upsert({
    where: { tenantId_slug: { tenantId: TENANT_IDS.FASHION, slug: 'summer-monochrome-outfit' } },
    update: {},
    create: {
      tenantId: TENANT_IDS.FASHION,
      title: 'Summer Monochrome Outfit',
      slug: 'summer-monochrome-outfit',
      type: 'OUTFIT',
      parentId: parentLookbook.id,
      description: 'Complete 3-piece oversized monochrome fit.',
      metadata: { colorTheme: 'Monochrome Black & White' },
      isPublic: true,
    },
  });

  // Add items to Fashion Outfit if products exist
  if (fashionProducts.length > 0) {
    for (let i = 0; i < fashionProducts.length; i++) {
      const prod = fashionProducts[i];
      const slots = ['UpperGarment', 'LowerGarment', 'Footwear', 'Accessory'];
      await prisma.catalogCollectionItem.create({
        data: {
          collectionId: outfitCollection.id,
          productId: prod.id,
          productVariantId: prod.variants[0]?.id || null,
          slot: slots[i % slots.length],
          position: i,
          isOptional: i > 1,
        },
      });
    }
  }

  // 3. Tech Setup Collection
  const techSetup = await prisma.catalogCollection.upsert({
    where: { tenantId_slug: { tenantId: TENANT_IDS.ELECTRONICS, slug: 'pro-creator-desk-setup' } },
    update: {},
    create: {
      tenantId: TENANT_IDS.ELECTRONICS,
      title: 'Pro Creator & Gaming Desk Setup',
      slug: 'pro-creator-desk-setup',
      type: 'SETUP',
      description: 'Ultimate workstation bundle for video editors, streamers, and developers.',
      metadata: { roomType: 'Home Office', powerRequirement: 'High' },
      isPublic: true,
    },
  });

  if (techProducts.length > 0) {
    for (let i = 0; i < techProducts.length; i++) {
      const prod = techProducts[i];
      const slots = ['PrimaryDisplay', 'WorkstationPC', 'AudioMic', 'Peripherals'];
      await prisma.catalogCollectionItem.create({
        data: {
          collectionId: techSetup.id,
          productId: prod.id,
          productVariantId: prod.variants[0]?.id || null,
          slot: slots[i % slots.length],
          position: i,
          isOptional: false,
        },
      });
    }
  }

  process.stdout.write('✅ Seeded Catalog Collections & Lookbooks!\n');
}
