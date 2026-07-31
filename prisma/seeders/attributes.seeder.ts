import { PrismaClient, AttributeType } from '@prisma/client';
import { TENANT_IDS } from './tenants.seeder';

export async function seedAttributes(prisma: PrismaClient) {
  process.stdout.write('🌱 Seeding EAV Catalog Attributes...\n');

  // Fashion Attributes
  const fashionColor = await prisma.catalogAttribute.upsert({
    where: { tenantId_code: { tenantId: TENANT_IDS.FASHION, code: 'color' } },
    update: {},
    create: {
      tenantId: TENANT_IDS.FASHION,
      name: 'Color',
      code: 'color',
      type: AttributeType.SELECT,
      isFilterable: true,
      isSearchable: true,
      values: {
        create: [
          { value: 'black', label: 'Black', swatchColor: '#000000', position: 1 },
          { value: 'white', label: 'White', swatchColor: '#FFFFFF', position: 2 },
          { value: 'navy', label: 'Navy Blue', swatchColor: '#000080', position: 3 },
          { value: 'crimson', label: 'Crimson Red', swatchColor: '#DC143C', position: 4 },
        ],
      },
    },
  });

  const fashionSize = await prisma.catalogAttribute.upsert({
    where: { tenantId_code: { tenantId: TENANT_IDS.FASHION, code: 'size' } },
    update: {},
    create: {
      tenantId: TENANT_IDS.FASHION,
      name: 'Size',
      code: 'size',
      type: AttributeType.SELECT,
      isFilterable: true,
      isSearchable: true,
      values: {
        create: [
          { value: 's', label: 'Small (S)', position: 1 },
          { value: 'm', label: 'Medium (M)', position: 2 },
          { value: 'l', label: 'Large (L)', position: 3 },
          { value: 'xl', label: 'Extra Large (XL)', position: 4 },
        ],
      },
    },
  });

  // Electronics Attributes
  const _techRam = await prisma.catalogAttribute.upsert({
    where: { tenantId_code: { tenantId: TENANT_IDS.ELECTRONICS, code: 'ram' } },
    update: {},
    create: {
      tenantId: TENANT_IDS.ELECTRONICS,
      name: 'RAM Memory',
      code: 'ram',
      type: AttributeType.SELECT,
      isFilterable: true,
      isSearchable: true,
      values: {
        create: [
          { value: '8gb', label: '8GB Unified Memory', position: 1 },
          { value: '16gb', label: '16GB LPDDR5', position: 2 },
          { value: '32gb', label: '32GB DDR5', position: 3 },
          { value: '64gb', label: '64GB High-Performance', position: 4 },
        ],
      },
    },
  });

  const _techStorage = await prisma.catalogAttribute.upsert({
    where: { tenantId_code: { tenantId: TENANT_IDS.ELECTRONICS, code: 'storage' } },
    update: {},
    create: {
      tenantId: TENANT_IDS.ELECTRONICS,
      name: 'Storage Capacity',
      code: 'storage',
      type: AttributeType.SELECT,
      isFilterable: true,
      isSearchable: true,
      values: {
        create: [
          { value: '256gb', label: '256GB NVMe SSD', position: 1 },
          { value: '512gb', label: '512GB PCIe Gen4 SSD', position: 2 },
          { value: '1tb', label: '1TB Ultra-Fast SSD', position: 3 },
        ],
      },
    },
  });

  // Beauty Attributes
  const _beautySkinType = await prisma.catalogAttribute.upsert({
    where: { tenantId_code: { tenantId: TENANT_IDS.BEAUTY, code: 'skin_type' } },
    update: {},
    create: {
      tenantId: TENANT_IDS.BEAUTY,
      name: 'Skin Type',
      code: 'skin_type',
      type: AttributeType.SELECT,
      isFilterable: true,
      isSearchable: true,
      values: {
        create: [
          { value: 'all', label: 'All Skin Types', position: 1 },
          { value: 'oily', label: 'Oily & Acne-Prone', position: 2 },
          { value: 'dry', label: 'Dry & Dehydrated', position: 3 },
          { value: 'sensitive', label: 'Sensitive', position: 4 },
        ],
      },
    },
  });

  // Link attributes to existing product variants
  const fashionVariants = await prisma.catalogProductVariant.findMany({
    where: { tenantId: TENANT_IDS.FASHION },
    take: 5,
  });

  if (fashionVariants.length > 0 && fashionColor) {
    const colorValues = await prisma.catalogAttributeValue.findMany({
      where: { attributeId: fashionColor.id },
    });
    const sizeValues = await prisma.catalogAttributeValue.findMany({
      where: { attributeId: fashionSize.id },
    });

    for (let i = 0; i < fashionVariants.length; i++) {
      const variant = fashionVariants[i];
      const colorVal = colorValues[i % colorValues.length];
      const sizeVal = sizeValues[i % sizeValues.length];

      if (colorVal) {
        await prisma.catalogVariantAttribute.upsert({
          where: { variantId_valueId: { variantId: variant.id, valueId: colorVal.id } },
          update: {},
          create: { variantId: variant.id, valueId: colorVal.id },
        });
      }
      if (sizeVal) {
        await prisma.catalogVariantAttribute.upsert({
          where: { variantId_valueId: { variantId: variant.id, valueId: sizeVal.id } },
          update: {},
          create: { variantId: variant.id, valueId: sizeVal.id },
        });
      }
    }
  }

  process.stdout.write('✅ Seeded Catalog EAV Attributes & Variant mappings!\n');
}
