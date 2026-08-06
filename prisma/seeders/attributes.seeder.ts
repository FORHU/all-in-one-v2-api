import { PrismaClient, AttributeType } from '@prisma/client';
import { TENANT_IDS } from './tenants.seeder';

interface AttributeValueSeed {
  value: string;
  label: string;
  swatchColor?: string;
}

interface AttributeSeed {
  code: string;
  name: string;
  type: AttributeType;
  values: AttributeValueSeed[];
}

/**
 * >=5 CatalogAttribute definitions per tenant. The first two attributes in
 * each tenant's list are treated as the "primary" pair (analogous to
 * color/size) and get linked onto real CatalogProductVariant rows below.
 */
const ATTRIBUTES_BY_TENANT: Record<string, AttributeSeed[]> = {
  [TENANT_IDS.FASHION]: [
    {
      code: 'color',
      name: 'Color',
      type: AttributeType.SELECT,
      values: [
        { value: 'black', label: 'Black', swatchColor: '#000000' },
        { value: 'white', label: 'White', swatchColor: '#FFFFFF' },
        { value: 'navy', label: 'Navy Blue', swatchColor: '#000080' },
        { value: 'crimson', label: 'Crimson Red', swatchColor: '#DC143C' },
        { value: 'olive', label: 'Olive Green', swatchColor: '#708238' },
      ],
    },
    {
      code: 'size',
      name: 'Size',
      type: AttributeType.SELECT,
      values: [
        { value: 'xs', label: 'Extra Small (XS)' },
        { value: 's', label: 'Small (S)' },
        { value: 'm', label: 'Medium (M)' },
        { value: 'l', label: 'Large (L)' },
        { value: 'xl', label: 'Extra Large (XL)' },
      ],
    },
    {
      code: 'material',
      name: 'Material',
      type: AttributeType.SELECT,
      values: [
        { value: 'cotton', label: '100% Cotton' },
        { value: 'polyester', label: 'Polyester Blend' },
        { value: 'denim', label: 'Denim' },
        { value: 'fleece', label: 'French Terry Fleece' },
        { value: 'satin', label: 'Satin' },
      ],
    },
    {
      code: 'fit',
      name: 'Fit',
      type: AttributeType.SELECT,
      values: [
        { value: 'relaxed', label: 'Relaxed Fit' },
        { value: 'oversized', label: 'Oversized Fit' },
        { value: 'slim', label: 'Slim Fit' },
        { value: 'regular', label: 'Regular Fit' },
        { value: 'tailored', label: 'Tailored Fit' },
      ],
    },
    {
      code: 'pattern',
      name: 'Pattern',
      type: AttributeType.SELECT,
      values: [
        { value: 'solid', label: 'Solid' },
        { value: 'graphic', label: 'Graphic Print' },
        { value: 'floral', label: 'Floral' },
        { value: 'striped', label: 'Striped' },
        { value: 'camo', label: 'Camo' },
      ],
    },
  ],
  [TENANT_IDS.BEAUTY]: [
    {
      code: 'skin_type',
      name: 'Skin Type',
      type: AttributeType.SELECT,
      values: [
        { value: 'all', label: 'All Skin Types' },
        { value: 'oily', label: 'Oily & Acne-Prone' },
        { value: 'dry', label: 'Dry & Dehydrated' },
        { value: 'sensitive', label: 'Sensitive' },
        { value: 'combination', label: 'Combination' },
      ],
    },
    {
      code: 'volume',
      name: 'Volume',
      type: AttributeType.SELECT,
      values: [
        { value: '30ml', label: '30ml' },
        { value: '50ml', label: '50ml' },
        { value: '100ml', label: '100ml' },
        { value: '200ml', label: '200ml' },
        { value: '400ml', label: '400ml' },
      ],
    },
    {
      code: 'scent',
      name: 'Scent',
      type: AttributeType.SELECT,
      values: [
        { value: 'floral', label: 'Floral' },
        { value: 'citrus', label: 'Citrus' },
        { value: 'woody', label: 'Woody' },
        { value: 'unscented', label: 'Unscented' },
        { value: 'fresh', label: 'Fresh Linen' },
      ],
    },
    {
      code: 'finish',
      name: 'Finish',
      type: AttributeType.SELECT,
      values: [
        { value: 'matte', label: 'Matte' },
        { value: 'dewy', label: 'Dewy' },
        { value: 'satin', label: 'Satin' },
        { value: 'glossy', label: 'Glossy' },
        { value: 'natural', label: 'Natural' },
      ],
    },
    {
      code: 'ingredient_focus',
      name: 'Key Ingredient',
      type: AttributeType.SELECT,
      values: [
        { value: 'vitamin-c', label: 'Vitamin C' },
        { value: 'hyaluronic-acid', label: 'Hyaluronic Acid' },
        { value: 'retinol', label: 'Retinol' },
        { value: 'niacinamide', label: 'Niacinamide' },
        { value: 'shea-butter', label: 'Shea Butter' },
      ],
    },
  ],
  [TENANT_IDS.ELECTRONICS]: [
    {
      code: 'color',
      name: 'Color',
      type: AttributeType.SELECT,
      values: [
        { value: 'black', label: 'Black', swatchColor: '#000000' },
        { value: 'white', label: 'White', swatchColor: '#FFFFFF' },
        { value: 'silver', label: 'Silver', swatchColor: '#C0C0C0' },
        { value: 'blue', label: 'Blue', swatchColor: '#1E3A8A' },
        { value: 'red', label: 'Red', swatchColor: '#DC143C' },
      ],
    },
    {
      code: 'connectivity',
      name: 'Connectivity',
      type: AttributeType.SELECT,
      values: [
        { value: 'bluetooth', label: 'Bluetooth' },
        { value: 'wifi', label: 'Wi-Fi' },
        { value: 'usb-c', label: 'USB-C' },
        { value: 'wireless-2-4g', label: '2.4GHz Wireless' },
        { value: 'nfc', label: 'NFC' },
      ],
    },
    {
      code: 'ram',
      name: 'RAM Memory',
      type: AttributeType.SELECT,
      values: [
        { value: '8gb', label: '8GB' },
        { value: '16gb', label: '16GB' },
        { value: '32gb', label: '32GB' },
        { value: '64gb', label: '64GB' },
        { value: '128gb', label: '128GB' },
      ],
    },
    {
      code: 'storage',
      name: 'Storage Capacity',
      type: AttributeType.SELECT,
      values: [
        { value: '256gb', label: '256GB SSD' },
        { value: '512gb', label: '512GB SSD' },
        { value: '1tb', label: '1TB SSD' },
        { value: '2tb', label: '2TB SSD' },
        { value: '4tb', label: '4TB SSD' },
      ],
    },
    {
      code: 'warranty',
      name: 'Warranty',
      type: AttributeType.SELECT,
      values: [
        { value: '6-months', label: '6 Months' },
        { value: '1-year', label: '1 Year' },
        { value: '2-years', label: '2 Years' },
        { value: '3-years', label: '3 Years' },
        { value: 'lifetime', label: 'Lifetime' },
      ],
    },
  ],
  [TENANT_IDS.LIVING]: [
    {
      code: 'color',
      name: 'Color',
      type: AttributeType.SELECT,
      values: [
        { value: 'white', label: 'White', swatchColor: '#FFFFFF' },
        { value: 'charcoal', label: 'Charcoal', swatchColor: '#36454F' },
        { value: 'cream', label: 'Cream', swatchColor: '#FFFDD0' },
        { value: 'sage-green', label: 'Sage Green', swatchColor: '#9CAF88' },
        { value: 'walnut', label: 'Walnut Brown', swatchColor: '#5C4033' },
      ],
    },
    {
      code: 'material',
      name: 'Material',
      type: AttributeType.SELECT,
      values: [
        { value: 'oak-wood', label: 'Solid Oak Wood' },
        { value: 'boucle', label: 'Boucle Fabric' },
        { value: 'ceramic', label: 'Ceramic' },
        { value: 'cotton', label: 'Cotton' },
        { value: 'bamboo', label: 'Bamboo' },
      ],
    },
    {
      code: 'dimensions',
      name: 'Dimensions',
      type: AttributeType.SELECT,
      values: [
        { value: 'small', label: 'Small' },
        { value: 'medium', label: 'Medium' },
        { value: 'large', label: 'Large' },
        { value: 'queen', label: 'Queen' },
        { value: 'king', label: 'King' },
      ],
    },
    {
      code: 'room',
      name: 'Room',
      type: AttributeType.SELECT,
      values: [
        { value: 'living-room', label: 'Living Room' },
        { value: 'bedroom', label: 'Bedroom' },
        { value: 'kitchen', label: 'Kitchen' },
        { value: 'office', label: 'Office' },
        { value: 'bathroom', label: 'Bathroom' },
      ],
    },
    {
      code: 'style',
      name: 'Style',
      type: AttributeType.SELECT,
      values: [
        { value: 'mid-century', label: 'Mid-Century Modern' },
        { value: 'scandinavian', label: 'Scandinavian' },
        { value: 'bohemian', label: 'Bohemian' },
        { value: 'minimalist', label: 'Minimalist' },
        { value: 'industrial', label: 'Industrial' },
      ],
    },
  ],
  [TENANT_IDS.OUTDOOR]: [
    {
      code: 'color',
      name: 'Color',
      type: AttributeType.SELECT,
      values: [
        { value: 'black', label: 'Black', swatchColor: '#000000' },
        { value: 'forest-green', label: 'Forest Green', swatchColor: '#228B22' },
        { value: 'graphite', label: 'Graphite', swatchColor: '#41424C' },
        { value: 'coral', label: 'Coral', swatchColor: '#FF7F50' },
        { value: 'electric-blue', label: 'Electric Blue', swatchColor: '#7DF9FF' },
      ],
    },
    {
      code: 'capacity',
      name: 'Capacity',
      type: AttributeType.SELECT,
      values: [
        { value: '20l', label: '20L' },
        { value: '28l', label: '28L' },
        { value: '32oz', label: '32oz' },
        { value: '2-person', label: '2-Person' },
        { value: '4-person', label: '4-Person' },
      ],
    },
    {
      code: 'weatherproofing',
      name: 'Weatherproofing',
      type: AttributeType.SELECT,
      values: [
        { value: 'water-resistant', label: 'Water-Resistant' },
        { value: 'waterproof', label: 'Waterproof' },
        { value: 'uv-resistant', label: 'UV-Resistant' },
        { value: 'windproof', label: 'Windproof' },
        { value: 'quick-dry', label: 'Quick-Dry' },
      ],
    },
    {
      code: 'weight_class',
      name: 'Weight Class',
      type: AttributeType.SELECT,
      values: [
        { value: 'ultralight', label: 'Ultralight' },
        { value: 'lightweight', label: 'Lightweight' },
        { value: 'standard', label: 'Standard' },
        { value: 'heavy-duty', label: 'Heavy-Duty' },
        { value: 'packable', label: 'Packable' },
      ],
    },
    {
      code: 'season',
      name: 'Season Rating',
      type: AttributeType.SELECT,
      values: [
        { value: '3-season', label: '3-Season' },
        { value: '4-season', label: '4-Season' },
        { value: 'summer', label: 'Summer' },
        { value: 'all-season', label: 'All-Season' },
        { value: 'winter', label: 'Winter' },
      ],
    },
  ],
};

export async function seedAttributes(prisma: PrismaClient) {
  process.stdout.write('🌱 Seeding EAV Catalog Attributes for 5 Tenants...\n');

  for (const [tenantId, attributeDefs] of Object.entries(ATTRIBUTES_BY_TENANT)) {
    const createdAttributes: { code: string; id: string }[] = [];

    for (let i = 0; i < attributeDefs.length; i++) {
      const def = attributeDefs[i];
      const attribute = await prisma.catalogAttribute.upsert({
        where: { tenantId_code: { tenantId, code: def.code } },
        update: {},
        create: {
          tenantId,
          name: def.name,
          code: def.code,
          type: def.type,
          isFilterable: true,
          isSearchable: true,
          values: {
            create: def.values.map((v, idx) => ({
              value: v.value,
              label: v.label,
              swatchColor: v.swatchColor,
              position: idx + 1,
            })),
          },
        },
      });
      createdAttributes.push({ code: def.code, id: attribute.id });
    }

    // Link the first two ("primary") attributes onto real product variants for this tenant
    const primaryAttr = createdAttributes[0];
    const secondaryAttr = createdAttributes[1];

    if (primaryAttr && secondaryAttr) {
      const variants = await prisma.catalogProductVariant.findMany({ where: { tenantId } });
      const primaryValues = await prisma.catalogAttributeValue.findMany({
        where: { attributeId: primaryAttr.id },
      });
      const secondaryValues = await prisma.catalogAttributeValue.findMany({
        where: { attributeId: secondaryAttr.id },
      });

      for (let i = 0; i < variants.length; i++) {
        const variant = variants[i];
        const primaryVal = primaryValues[i % primaryValues.length];
        const secondaryVal = secondaryValues[i % secondaryValues.length];

        if (primaryVal) {
          await prisma.catalogVariantAttribute.upsert({
            where: { variantId_valueId: { variantId: variant.id, valueId: primaryVal.id } },
            update: {},
            create: { variantId: variant.id, valueId: primaryVal.id },
          });
        }
        if (secondaryVal) {
          await prisma.catalogVariantAttribute.upsert({
            where: { variantId_valueId: { variantId: variant.id, valueId: secondaryVal.id } },
            update: {},
            create: { variantId: variant.id, valueId: secondaryVal.id },
          });
        }
      }
    }
  }

  process.stdout.write('✅ Seeded Catalog EAV Attributes & Variant mappings for all tenants!\n');
}

export default seedAttributes;
