import { PrismaClient } from '@prisma/client';
import { TENANT_IDS } from './tenants.seeder';

interface SizeEntrySeed {
  sizeLabel: string;
  position: number;
  variantSku?: string; // if set, links this entry onto that variant's sizeEntryId
  chest?: number;
  waist?: number;
  hips?: number;
  inseam?: number;
  length?: number;
  shoulder?: number;
  sleeve?: number;
  footLength?: number;
  width?: number;
  height?: number;
  depth?: number;
  screenSize?: number;
  weight?: number;
  weightUnit?: string;
}

interface SizeGuideSeed {
  productSlug: string;
  label: string;
  description: string;
  unit: string;
  entries: SizeEntrySeed[];
}

const SIZE_GUIDES_BY_TENANT: Record<string, SizeGuideSeed[]> = {
  [TENANT_IDS.FASHION]: [
    {
      productSlug: 'heavyweight-oversized-fleece-hoodie',
      label: 'Oversized Hoodie Sizing Chart',
      description: 'Standard oversized fleece measurements in centimeters (CM).',
      unit: 'CM',
      entries: [
        {
          sizeLabel: 'M',
          position: 1,
          variantSku: 'HD-001-NVY-M',
          chest: 108,
          waist: 92,
          sleeve: 62,
          shoulder: 48,
          length: 72,
        },
        {
          sizeLabel: 'L',
          position: 2,
          chest: 114,
          waist: 98,
          sleeve: 64,
          shoulder: 50,
          length: 74,
        },
        {
          sizeLabel: 'XL',
          position: 3,
          variantSku: 'HD-001-BLK-XL',
          chest: 120,
          waist: 104,
          sleeve: 66,
          shoulder: 52,
          length: 76,
        },
      ],
    },
    {
      productSlug: 'essential-oversized-graphic-tee',
      label: 'Relaxed Tee Sizing Chart',
      description: 'Boxy oversized tee measurements in centimeters (CM).',
      unit: 'CM',
      entries: [
        {
          sizeLabel: 'S',
          position: 1,
          variantSku: 'TEE-002-WHT-S',
          chest: 102,
          length: 68,
          shoulder: 44,
        },
        {
          sizeLabel: 'M',
          position: 2,
          variantSku: 'TEE-002-WHT-M',
          chest: 108,
          length: 70,
          shoulder: 46,
        },
        {
          sizeLabel: 'M-Black',
          position: 3,
          variantSku: 'TEE-002-BLK-M',
          chest: 108,
          length: 70,
          shoulder: 46,
        },
      ],
    },
    {
      productSlug: 'tactical-relaxed-cargo-pants',
      label: 'Cargo Pants Waist & Length Chart',
      description: 'Wide-leg cargo pants measurements in centimeters (CM).',
      unit: 'CM',
      entries: [
        {
          sizeLabel: 'W30',
          position: 1,
          variantSku: 'CGO-003-BLK-30',
          waist: 76,
          hips: 102,
          inseam: 76,
        },
        {
          sizeLabel: 'W32',
          position: 2,
          variantSku: 'CGO-003-OLV-32',
          waist: 81,
          hips: 107,
          inseam: 78,
        },
        { sizeLabel: 'W34', position: 3, waist: 86, hips: 112, inseam: 80 },
      ],
    },
    {
      productSlug: 'y2k-satin-bomber-jacket',
      label: 'Bomber Jacket Sizing Chart',
      description: 'Satin bomber jacket measurements in centimeters (CM).',
      unit: 'CM',
      entries: [
        {
          sizeLabel: 'M',
          position: 1,
          variantSku: 'BMB-004-BLK-M',
          chest: 106,
          shoulder: 47,
          sleeve: 63,
          length: 66,
        },
        {
          sizeLabel: 'L',
          position: 2,
          variantSku: 'BMB-004-SLV-L',
          chest: 112,
          shoulder: 49,
          sleeve: 65,
          length: 68,
        },
      ],
    },
    {
      productSlug: 'floral-wrap-midi-dress',
      label: 'Wrap Dress Sizing Chart',
      description: 'Wrap midi dress measurements in centimeters (CM).',
      unit: 'CM',
      entries: [
        {
          sizeLabel: 'S',
          position: 1,
          variantSku: 'DRS-006-FLR-S',
          chest: 86,
          waist: 68,
          hips: 94,
          length: 108,
        },
        {
          sizeLabel: 'M',
          position: 2,
          variantSku: 'DRS-006-FLR-M',
          chest: 91,
          waist: 73,
          hips: 99,
          length: 110,
        },
        {
          sizeLabel: 'M-Pink',
          position: 3,
          variantSku: 'DRS-006-PNK-M',
          chest: 91,
          waist: 73,
          hips: 99,
          length: 110,
        },
      ],
    },
    {
      productSlug: 'urban-air-cushion-running-sneakers',
      label: 'Footwear Size Chart',
      description: 'International EU shoe sizing mapped to foot length.',
      unit: 'EU',
      entries: [
        { sizeLabel: 'EU 41', position: 1, variantSku: 'SNK-005-WHT-41', footLength: 26.0 },
        { sizeLabel: 'EU 42', position: 2, variantSku: 'SNK-005-BLK-42', footLength: 26.7 },
        { sizeLabel: 'EU 43', position: 3, variantSku: 'SNK-005-RED-43', footLength: 27.3 },
      ],
    },
  ],
  [TENANT_IDS.BEAUTY]: [
    {
      productSlug: 'vitamin-c-brightening-serum',
      label: 'Serum Volume Guide',
      description: 'Available bottle volumes for the Vitamin C Brightening Serum.',
      unit: 'ML',
      entries: [
        {
          sizeLabel: '30ml',
          position: 1,
          variantSku: 'SRM-002-30ML',
          weight: 30,
          weightUnit: 'ML',
        },
        {
          sizeLabel: '50ml',
          position: 2,
          variantSku: 'SRM-002-50ML',
          weight: 50,
          weightUnit: 'ML',
        },
      ],
    },
    {
      productSlug: 'hydrating-hyaluronic-acid-moisturizer',
      label: 'Moisturizer Volume Guide',
      description: 'Available jar sizes for the Hyaluronic Acid Moisturizer.',
      unit: 'ML',
      entries: [
        {
          sizeLabel: '50ml',
          position: 1,
          variantSku: 'MST-003-50ML',
          weight: 50,
          weightUnit: 'ML',
        },
        {
          sizeLabel: '100ml',
          position: 2,
          variantSku: 'MST-003-100ML',
          weight: 100,
          weightUnit: 'ML',
        },
      ],
    },
    {
      productSlug: 'citrus-bloom-eau-de-parfum',
      label: 'Fragrance Volume Guide',
      description: 'Available bottle sizes for Citrus Bloom Eau de Parfum.',
      unit: 'ML',
      entries: [
        {
          sizeLabel: '30ml',
          position: 1,
          variantSku: 'EDP-006-30ML',
          weight: 30,
          weightUnit: 'ML',
        },
        {
          sizeLabel: '50ml',
          position: 2,
          variantSku: 'EDP-006-50ML',
          weight: 50,
          weightUnit: 'ML',
        },
        {
          sizeLabel: '100ml',
          position: 3,
          variantSku: 'EDP-006-100ML',
          weight: 100,
          weightUnit: 'ML',
        },
      ],
    },
    {
      productSlug: 'jasmine-shea-body-butter',
      label: 'Body Butter Jar Size Guide',
      description: 'Available jar sizes for the Jasmine & Shea Body Butter.',
      unit: 'ML',
      entries: [
        {
          sizeLabel: '200ml',
          position: 1,
          variantSku: 'BTR-007-200ML',
          weight: 200,
          weightUnit: 'ML',
        },
        {
          sizeLabel: '400ml',
          position: 2,
          variantSku: 'BTR-007-400ML',
          weight: 400,
          weightUnit: 'ML',
        },
      ],
    },
    {
      productSlug: 'waterproof-sonic-facial-cleansing-brush',
      label: 'Device Dimensions Guide',
      description: 'Physical dimensions of the Sonic Facial Cleansing Brush.',
      unit: 'CM',
      entries: [
        {
          sizeLabel: 'Standard',
          position: 1,
          height: 16.5,
          width: 4.2,
          weight: 0.12,
          weightUnit: 'KG',
        },
      ],
    },
    {
      productSlug: 'professional-ionic-hair-dryer',
      label: 'Device Dimensions Guide',
      description: 'Physical dimensions of the Ionic Hair Dryer.',
      unit: 'CM',
      entries: [
        {
          sizeLabel: 'Standard',
          position: 1,
          height: 24.0,
          width: 9.5,
          weight: 0.65,
          weightUnit: 'KG',
        },
      ],
    },
  ],
  [TENANT_IDS.ELECTRONICS]: [
    {
      productSlug: 'ultra-hd-4k-streaming-webcam-ring-light',
      label: 'Camera Dimensions Guide',
      description: 'Physical dimensions of the 4K Streaming Webcam.',
      unit: 'CM',
      entries: [
        {
          sizeLabel: 'Standard',
          position: 1,
          width: 9.4,
          height: 3.8,
          depth: 4.2,
          weight: 0.3,
          weightUnit: 'KG',
        },
      ],
    },
    {
      productSlug: 'compact-75-mechanical-rgb-keyboard',
      label: 'Keyboard Dimensions Guide',
      description: 'Physical dimensions of the 75% Mechanical Keyboard.',
      unit: 'CM',
      entries: [
        {
          sizeLabel: 'Standard',
          position: 1,
          width: 32.5,
          depth: 13.6,
          height: 3.6,
          weight: 0.75,
          weightUnit: 'KG',
        },
      ],
    },
    {
      productSlug: 'portable-waterproof-bluetooth-speaker',
      label: 'Speaker Dimensions & Weight Guide',
      description: 'Physical dimensions of the Waterproof Bluetooth Speaker.',
      unit: 'CM',
      entries: [
        {
          sizeLabel: 'Standard',
          position: 1,
          height: 18.6,
          width: 8.6,
          weight: 0.55,
          weightUnit: 'KG',
        },
      ],
    },
    {
      productSlug: 'fitness-smartwatch-amoled-display',
      label: 'Watch Case Size Guide',
      description: 'Available case diameters for the Fitness Smartwatch.',
      unit: 'MM',
      entries: [
        { sizeLabel: '42mm', position: 1, variantSku: 'WATCH-006-GRP-42', screenSize: 42 },
        { sizeLabel: '46mm', position: 2, variantSku: 'WATCH-006-SLV-46', screenSize: 46 },
        { sizeLabel: '42mm-RoseGold', position: 3, variantSku: 'WATCH-006-RGD-42', screenSize: 42 },
      ],
    },
    {
      productSlug: 'smart-home-hub-with-voice-control',
      label: 'Hub Dimensions Guide',
      description: 'Physical dimensions of the Smart Home Hub.',
      unit: 'CM',
      entries: [
        {
          sizeLabel: 'Standard',
          position: 1,
          width: 10.0,
          height: 10.0,
          depth: 3.5,
          weight: 0.4,
          weightUnit: 'KG',
        },
      ],
    },
  ],
  [TENANT_IDS.LIVING]: [
    {
      productSlug: 'handwoven-jute-area-rug',
      label: 'Rug Size Guide',
      description: 'Available rug dimensions in feet.',
      unit: 'FT',
      entries: [
        { sizeLabel: '5x7 ft', position: 1, variantSku: 'RUG-004-5X7', width: 5, length: 7 },
        { sizeLabel: '8x10 ft', position: 2, variantSku: 'RUG-004-8X10', width: 8, length: 10 },
      ],
    },
    {
      productSlug: 'egyptian-cotton-bedsheet-set',
      label: 'Bed Size Guide',
      description: 'Mattress dimensions covered by each bedsheet set size.',
      unit: 'CM',
      entries: [
        { sizeLabel: 'Queen', position: 1, variantSku: 'SHT-006-QN-IVR', width: 152, length: 203 },
        { sizeLabel: 'King', position: 2, variantSku: 'SHT-006-KG-SLT', width: 193, length: 203 },
        {
          sizeLabel: 'Queen-Slate',
          position: 3,
          variantSku: 'SHT-006-QN-SLT',
          width: 152,
          length: 203,
        },
      ],
    },
    {
      productSlug: 'modular-bamboo-storage-shelf',
      label: 'Shelf Dimensions Guide',
      description: 'Dimensions for each shelving configuration.',
      unit: 'CM',
      entries: [
        {
          sizeLabel: '3-Tier',
          position: 1,
          variantSku: 'SHF-007-3T-NAT',
          width: 80,
          height: 90,
          depth: 30,
        },
        {
          sizeLabel: '4-Tier',
          position: 2,
          variantSku: 'SHF-007-4T-WAL',
          width: 80,
          height: 120,
          depth: 30,
        },
      ],
    },
    {
      productSlug: 'mid-century-boucle-accent-chair',
      label: 'Furniture Dimensions Guide',
      description: 'Overall dimensions of the accent chair.',
      unit: 'CM',
      entries: [
        {
          sizeLabel: 'Standard',
          position: 1,
          width: 76,
          height: 79,
          depth: 71,
          weight: 14.5,
          weightUnit: 'KG',
        },
      ],
    },
    {
      productSlug: 'ceramic-dinnerware-set-12-piece',
      label: 'Plate Diameter Guide',
      description: 'Diameters of each piece included in the 12-piece set.',
      unit: 'CM',
      entries: [
        { sizeLabel: 'Dinner Plate', position: 1, width: 27 },
        { sizeLabel: 'Salad Plate', position: 2, width: 21 },
        { sizeLabel: 'Bowl', position: 3, width: 15 },
      ],
    },
  ],
  [TENANT_IDS.OUTDOOR]: [
    {
      productSlug: 'double-wall-vacuum-insulated-bottle-32oz',
      label: 'Bottle Capacity Guide',
      description: 'Capacity and dimensions of the insulated steel bottle.',
      unit: 'OZ',
      entries: [{ sizeLabel: '32oz', position: 1, weight: 32, weightUnit: 'OZ', height: 27.5 }],
    },
    {
      productSlug: 'anti-slip-professional-yoga-mat-6mm',
      label: 'Mat Dimensions Guide',
      description: 'Rolled-out dimensions of the yoga mat.',
      unit: 'CM',
      entries: [{ sizeLabel: '6mm Standard', position: 1, width: 61, length: 183, depth: 0.6 }],
    },
    {
      productSlug: '3-season-backpacking-tent-2-person',
      label: 'Tent Capacity & Packed Size Guide',
      description: 'Sleeping capacity and packed dimensions.',
      unit: 'CM',
      entries: [
        {
          sizeLabel: '2-Person',
          position: 1,
          length: 213,
          width: 127,
          weight: 2.1,
          weightUnit: 'KG',
        },
      ],
    },
    {
      productSlug: 'all-terrain-hiking-backpack-28l',
      label: 'Backpack Capacity Guide',
      description: 'Volume capacity and torso fit range.',
      unit: 'L',
      entries: [{ sizeLabel: '28L', position: 1, weight: 1.1, weightUnit: 'KG', height: 55 }],
    },
    {
      productSlug: 'quick-dry-performance-cycling-jersey',
      label: 'Cycling Apparel Sizing Chart',
      description: 'Body measurements in centimeters (CM) for the cycling jersey.',
      unit: 'CM',
      entries: [
        {
          sizeLabel: 'M',
          position: 1,
          variantSku: 'JER-006-BLU-M',
          chest: 96,
          waist: 82,
          length: 68,
        },
        {
          sizeLabel: 'L',
          position: 2,
          variantSku: 'JER-006-BLU-L',
          chest: 102,
          waist: 88,
          length: 70,
        },
        {
          sizeLabel: 'L-Black',
          position: 3,
          variantSku: 'JER-006-BLK-L',
          chest: 102,
          waist: 88,
          length: 70,
        },
      ],
    },
    {
      productSlug: 'inflatable-stand-up-paddleboard-10ft',
      label: 'Paddleboard Dimensions Guide',
      description: 'Board length, width and packed weight.',
      unit: 'FT',
      entries: [
        { sizeLabel: '10ft', position: 1, length: 10, width: 2.6, weight: 9.8, weightUnit: 'KG' },
      ],
    },
  ],
};

export async function seedSizeGuides(prisma: PrismaClient) {
  process.stdout.write('🌱 Seeding Catalog Size Guides for 5 Tenants...\n');

  for (const [tenantId, guides] of Object.entries(SIZE_GUIDES_BY_TENANT)) {
    for (const guideDef of guides) {
      const product = await prisma.catalogProduct.findUnique({
        where: { tenantId_slug: { tenantId, slug: guideDef.productSlug } },
      });

      if (!product) {
        process.stderr.write(
          `⚠️ Product [${guideDef.productSlug}] not found for tenant [${tenantId}]. Skipping size guide.\n`,
        );
        continue;
      }

      const existing = await prisma.catalogSizeGuide.findFirst({
        where: { productId: product.id, label: guideDef.label },
        include: { entries: true },
      });

      const guide =
        existing ??
        (await prisma.catalogSizeGuide.create({
          data: {
            productId: product.id,
            label: guideDef.label,
            description: guideDef.description,
            unit: guideDef.unit,
            entries: {
              create: guideDef.entries.map((e) => ({
                sizeLabel: e.sizeLabel,
                position: e.position,
                chest: e.chest,
                waist: e.waist,
                hips: e.hips,
                inseam: e.inseam,
                length: e.length,
                shoulder: e.shoulder,
                sleeve: e.sleeve,
                footLength: e.footLength,
                width: e.width,
                height: e.height,
                depth: e.depth,
                screenSize: e.screenSize,
                weight: e.weight,
                weightUnit: e.weightUnit,
              })),
            },
          },
          include: { entries: true },
        }));

      // Link entries onto matching variants (by SKU) where specified
      for (const entryDef of guideDef.entries) {
        if (!entryDef.variantSku) continue;
        const entryRow = guide.entries.find((e) => e.sizeLabel === entryDef.sizeLabel);
        if (!entryRow) continue;

        const variant = await prisma.catalogProductVariant.findUnique({
          where: { tenantId_sku: { tenantId, sku: entryDef.variantSku } },
        });
        if (variant) {
          await prisma.catalogProductVariant.update({
            where: { id: variant.id },
            data: { sizeEntryId: entryRow.id },
          });
        }
      }
    }
  }

  process.stdout.write('✅ Seeded Catalog Size Guides & Variant linkages for all tenants!\n');
}

export default seedSizeGuides;
