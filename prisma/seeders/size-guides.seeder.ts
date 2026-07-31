import { PrismaClient } from '@prisma/client';
import { TENANT_IDS } from './tenants.seeder';

export async function seedSizeGuides(prisma: PrismaClient) {
  process.stdout.write('🌱 Seeding Catalog Size Guides...\n');

  const fashionProducts = await prisma.catalogProduct.findMany({
    where: { tenantId: TENANT_IDS.FASHION },
    include: { variants: true },
    take: 3,
  });

  if (fashionProducts.length === 0) return;

  const targetProduct = fashionProducts[0];

  // Create Fashion Size Guide linked to targetProduct
  const apparelSizeGuide = await prisma.catalogSizeGuide.create({
    data: {
      productId: targetProduct.id,
      label: 'Unisex Streetwear Apparel Sizing Chart',
      description: 'Standard oversized apparel measurements in centimeters (CM).',
      unit: 'CM',
      entries: {
        create: [
          {
            sizeLabel: 'S',
            chest: 102.0,
            waist: 86.0,
            hips: 96.0,
            sleeve: 60.0,
            shoulder: 46.0,
            length: 70.0,
            position: 1,
          },
          {
            sizeLabel: 'M',
            chest: 108.0,
            waist: 92.0,
            hips: 102.0,
            sleeve: 62.0,
            shoulder: 48.0,
            length: 72.0,
            position: 2,
          },
          {
            sizeLabel: 'L',
            chest: 114.0,
            waist: 98.0,
            hips: 108.0,
            sleeve: 64.0,
            shoulder: 50.0,
            length: 74.0,
            position: 3,
          },
          {
            sizeLabel: 'XL',
            chest: 120.0,
            waist: 104.0,
            hips: 114.0,
            sleeve: 66.0,
            shoulder: 52.0,
            length: 76.0,
            position: 4,
          },
        ],
      },
    },
    include: { entries: true },
  });

  // Link entries to variants
  for (const prod of fashionProducts) {
    for (let i = 0; i < prod.variants.length; i++) {
      const variant = prod.variants[i];
      const entry = apparelSizeGuide.entries[i % apparelSizeGuide.entries.length];
      if (entry) {
        await prisma.catalogProductVariant.update({
          where: { id: variant.id },
          data: { sizeEntryId: entry.id },
        });
      }
    }
  }

  process.stdout.write('✅ Seeded Catalog Size Guides & Variant linkages!\n');
}
