import { PrismaClient, Prisma, CollectionType } from '@prisma/client';
import { TENANT_IDS } from './tenants.seeder';

interface CollectionItemSeed {
  productSlug: string;
  variantSku?: string;
  slot: string;
  position: number;
  isOptional?: boolean;
}

interface CollectionSeed {
  title: string;
  slug: string;
  type: CollectionType;
  description: string;
  metadata?: Prisma.InputJsonValue;
  items: CollectionItemSeed[];
}

const COLLECTIONS_BY_TENANT: Record<string, CollectionSeed[]> = {
  [TENANT_IDS.FASHION]: [
    {
      title: 'Summer Monochrome Outfit',
      slug: 'summer-monochrome-outfit',
      type: CollectionType.OUTFIT,
      description: 'Complete 4-piece oversized monochrome fit for warm-weather city days.',
      metadata: { colorTheme: 'Monochrome Black' },
      items: [
        { productSlug: 'heavyweight-oversized-fleece-hoodie', variantSku: 'HD-001-BLK-XL', slot: 'UpperGarment', position: 0 },
        { productSlug: 'tactical-relaxed-cargo-pants', variantSku: 'CGO-003-BLK-30', slot: 'LowerGarment', position: 1 },
        { productSlug: 'urban-air-cushion-running-sneakers', variantSku: 'SNK-005-BLK-42', slot: 'Footwear', position: 2 },
        { productSlug: 'structured-6-panel-snapback-cap', variantSku: 'CAP-007-BLK', slot: 'Accessory', position: 3, isOptional: true },
      ],
    },
    {
      title: 'Streetwear Off-Duty Lookbook',
      slug: 'streetwear-off-duty-lookbook',
      type: CollectionType.LOOKBOOK,
      description: 'Layered streetwear looks for off-duty days around the city.',
      metadata: { season: 'Fall 2026', style: 'Streetwear' },
      items: [
        { productSlug: 'essential-oversized-graphic-tee', variantSku: 'TEE-002-WHT-M', slot: 'UpperGarment', position: 0 },
        { productSlug: 'y2k-satin-bomber-jacket', variantSku: 'BMB-004-BLK-M', slot: 'Outerwear', position: 1 },
        { productSlug: 'urban-air-cushion-running-sneakers', variantSku: 'SNK-005-WHT-41', slot: 'Footwear', position: 2 },
      ],
    },
    {
      title: 'Weekend Casual Fit',
      slug: 'weekend-casual-fit',
      type: CollectionType.OUTFIT,
      description: 'Relaxed weekend fit built around cargo pants and a graphic tee.',
      metadata: { colorTheme: 'Olive & Black' },
      items: [
        { productSlug: 'tactical-relaxed-cargo-pants', variantSku: 'CGO-003-OLV-32', slot: 'LowerGarment', position: 0 },
        { productSlug: 'essential-oversized-graphic-tee', variantSku: 'TEE-002-BLK-M', slot: 'UpperGarment', position: 1 },
        { productSlug: 'structured-6-panel-snapback-cap', variantSku: 'CAP-007-WHT', slot: 'Accessory', position: 2, isOptional: true },
      ],
    },
    {
      title: 'Date Night Ready',
      slug: 'date-night-ready',
      type: CollectionType.LOOKBOOK,
      description: 'A polished evening look pairing a wrap dress with a statement bomber.',
      metadata: { season: 'Spring 2026', style: 'Evening' },
      items: [
        { productSlug: 'floral-wrap-midi-dress', variantSku: 'DRS-006-PNK-M', slot: 'Dress', position: 0 },
        { productSlug: 'y2k-satin-bomber-jacket', variantSku: 'BMB-004-SLV-L', slot: 'Outerwear', position: 1, isOptional: true },
      ],
    },
    {
      title: 'All Black Everything',
      slug: 'all-black-everything',
      type: CollectionType.OUTFIT,
      description: 'A head-to-toe blacked-out fit for maximum versatility.',
      metadata: { colorTheme: 'All Black' },
      items: [
        { productSlug: 'heavyweight-oversized-fleece-hoodie', variantSku: 'HD-001-BLK-XL', slot: 'UpperGarment', position: 0 },
        { productSlug: 'tactical-relaxed-cargo-pants', variantSku: 'CGO-003-BLK-30', slot: 'LowerGarment', position: 1 },
        { productSlug: 'urban-air-cushion-running-sneakers', variantSku: 'SNK-005-BLK-42', slot: 'Footwear', position: 2 },
      ],
    },
  ],
  [TENANT_IDS.BEAUTY]: [
    {
      title: 'Morning Glow Skincare Routine',
      slug: 'morning-glow-skincare-routine',
      type: CollectionType.ROUTINE,
      description: 'A 3-step morning routine for brighter, cleaner skin.',
      metadata: { timeOfDay: 'Morning' },
      items: [
        { productSlug: 'waterproof-sonic-facial-cleansing-brush', variantSku: 'FAC-001-PNK', slot: 'Cleanser', position: 0 },
        { productSlug: 'vitamin-c-brightening-serum', variantSku: 'SRM-002-30ML', slot: 'Serum', position: 1 },
        { productSlug: 'hydrating-hyaluronic-acid-moisturizer', variantSku: 'MST-003-50ML', slot: 'Moisturizer', position: 2 },
      ],
    },
    {
      title: 'Evening Repair Routine',
      slug: 'evening-repair-routine',
      type: CollectionType.ROUTINE,
      description: 'Rich, restorative products for an overnight skin reset.',
      metadata: { timeOfDay: 'Evening' },
      items: [
        { productSlug: 'hydrating-hyaluronic-acid-moisturizer', variantSku: 'MST-003-100ML', slot: 'Moisturizer', position: 0 },
        { productSlug: 'jasmine-shea-body-butter', variantSku: 'BTR-007-200ML', slot: 'BodyCare', position: 1 },
      ],
    },
    {
      title: 'Complete Hair Care Routine',
      slug: 'complete-hair-care-routine',
      type: CollectionType.ROUTINE,
      description: 'Styling and cleansing essentials for salon-quality hair at home.',
      items: [
        { productSlug: 'professional-ionic-hair-dryer', variantSku: 'HDRYR-005-BLK', slot: 'StylingTool', position: 0 },
        { productSlug: 'waterproof-sonic-facial-cleansing-brush', variantSku: 'FAC-001-SGE', slot: 'Cleanser', position: 1, isOptional: true },
      ],
    },
    {
      title: 'Date Night Glam Routine',
      slug: 'date-night-glam-routine',
      type: CollectionType.ROUTINE,
      description: 'Bold lips and a signature scent for an evening out.',
      items: [
        { productSlug: 'matte-liquid-lipstick-trio', variantSku: 'LIP-004-WINE', slot: 'Lips', position: 0 },
        { productSlug: 'citrus-bloom-eau-de-parfum', variantSku: 'EDP-006-50ML', slot: 'Fragrance', position: 1 },
      ],
    },
    {
      title: 'Self-Care Sunday Set',
      slug: 'self-care-sunday-set',
      type: CollectionType.ROUTINE,
      description: 'A relaxing at-home pampering ritual.',
      items: [
        { productSlug: 'jasmine-shea-body-butter', variantSku: 'BTR-007-400ML', slot: 'BodyCare', position: 0 },
        { productSlug: 'citrus-bloom-eau-de-parfum', variantSku: 'EDP-006-30ML', slot: 'Fragrance', position: 1 },
        { productSlug: 'waterproof-sonic-facial-cleansing-brush', variantSku: 'FAC-001-PNK', slot: 'Cleanser', position: 2, isOptional: true },
      ],
    },
  ],
  [TENANT_IDS.ELECTRONICS]: [
    {
      title: 'Pro Creator & Gaming Desk Setup',
      slug: 'pro-creator-desk-setup',
      type: CollectionType.SETUP,
      description: 'Ultimate workstation bundle for video editors, streamers, and developers.',
      metadata: { roomType: 'Home Office', powerRequirement: 'High' },
      items: [
        { productSlug: 'compact-75-mechanical-rgb-keyboard', variantSku: 'KB-003-RED', slot: 'Keyboard', position: 0 },
        { productSlug: 'ergonomic-rgb-wireless-gaming-mouse', variantSku: 'GM-001-BLK', slot: 'Mouse', position: 1 },
        { productSlug: 'ultra-hd-4k-streaming-webcam-ring-light', variantSku: 'CAM-004-BLK', slot: 'Camera', position: 2 },
        { productSlug: 'portable-waterproof-bluetooth-speaker', variantSku: 'SPK-007-BLU', slot: 'Audio', position: 3, isOptional: true },
      ],
    },
    {
      title: 'Gaming Battlestation Bundle',
      slug: 'gaming-battlestation-bundle',
      type: CollectionType.BUNDLE,
      description: 'Core peripherals for a competitive gaming setup.',
      items: [
        { productSlug: 'ergonomic-rgb-wireless-gaming-mouse', variantSku: 'GM-001-WHT', slot: 'Mouse', position: 0 },
        { productSlug: 'compact-75-mechanical-rgb-keyboard', variantSku: 'KB-003-BRN', slot: 'Keyboard', position: 1 },
        { productSlug: 'active-noise-cancelling-wireless-headphones', variantSku: 'ANC-002-BLK', slot: 'Headset', position: 2 },
      ],
    },
    {
      title: 'Smart Home Starter Bundle',
      slug: 'smart-home-starter-bundle',
      type: CollectionType.BUNDLE,
      description: 'Everything needed to start automating your home.',
      metadata: { roomType: 'Whole Home' },
      items: [
        { productSlug: 'smart-home-hub-with-voice-control', variantSku: 'HUB-005-CHR', slot: 'Hub', position: 0 },
        { productSlug: 'portable-waterproof-bluetooth-speaker', variantSku: 'SPK-007-RED', slot: 'Audio', position: 1 },
      ],
    },
    {
      title: 'Fitness Tech Bundle',
      slug: 'fitness-tech-bundle',
      type: CollectionType.BUNDLE,
      description: 'Track workouts and listen without wires.',
      items: [
        { productSlug: 'fitness-smartwatch-amoled-display', variantSku: 'WATCH-006-GRP-42', slot: 'Wearable', position: 0 },
        { productSlug: 'active-noise-cancelling-wireless-headphones', variantSku: 'ANC-002-SLV', slot: 'Headset', position: 1 },
      ],
    },
    {
      title: 'Work From Home Audio Setup',
      slug: 'work-from-home-audio-setup',
      type: CollectionType.SETUP,
      description: 'Sound and video essentials for remote meetings.',
      metadata: { roomType: 'Home Office' },
      items: [
        { productSlug: 'active-noise-cancelling-wireless-headphones', variantSku: 'ANC-002-BLK', slot: 'Headset', position: 0 },
        { productSlug: 'ultra-hd-4k-streaming-webcam-ring-light', variantSku: 'CAM-004-WHT', slot: 'Camera', position: 1 },
        { productSlug: 'portable-waterproof-bluetooth-speaker', variantSku: 'SPK-007-BLU', slot: 'Audio', position: 2, isOptional: true },
      ],
    },
  ],
  [TENANT_IDS.LIVING]: [
    {
      title: 'Cozy Living Room Refresh Bundle',
      slug: 'cozy-living-room-refresh-bundle',
      type: CollectionType.BUNDLE,
      description: 'Refresh your living room with a chair, rug and ambient scent.',
      metadata: { roomType: 'Living Room' },
      items: [
        { productSlug: 'mid-century-boucle-accent-chair', variantSku: 'CHR-003-CRM', slot: 'Seating', position: 0 },
        { productSlug: 'handwoven-jute-area-rug', variantSku: 'RUG-004-5X7', slot: 'Rug', position: 1 },
        { productSlug: 'ultrasonic-cool-mist-aromatherapy-diffuser', variantSku: 'DIF-001-WOD', slot: 'Accent', position: 2, isOptional: true },
      ],
    },
    {
      title: 'Modern Bedroom Setup',
      slug: 'modern-bedroom-setup',
      type: CollectionType.SETUP,
      description: 'Fresh linens and warm lighting for a modern bedroom.',
      metadata: { roomType: 'Bedroom' },
      items: [
        { productSlug: 'egyptian-cotton-bedsheet-set', variantSku: 'SHT-006-QN-IVR', slot: 'Bedding', position: 0 },
        { productSlug: 'dimmable-led-desk-lamp-wireless-charging', variantSku: 'LMP-002-WHT', slot: 'Lighting', position: 1 },
      ],
    },
    {
      title: 'Dining Room Essentials Bundle',
      slug: 'dining-room-essentials-bundle',
      type: CollectionType.BUNDLE,
      description: 'Dinnerware and storage essentials for the dining room.',
      metadata: { roomType: 'Dining Room' },
      items: [
        { productSlug: 'ceramic-dinnerware-set-12-piece', variantSku: 'DIN-005-WHT', slot: 'Dinnerware', position: 0 },
        { productSlug: 'modular-bamboo-storage-shelf', variantSku: 'SHF-007-3T-NAT', slot: 'Storage', position: 1 },
      ],
    },
    {
      title: 'Home Office Setup',
      slug: 'home-office-setup',
      type: CollectionType.SETUP,
      description: 'Lighting and organization for a productive home office.',
      metadata: { roomType: 'Office' },
      items: [
        { productSlug: 'dimmable-led-desk-lamp-wireless-charging', variantSku: 'LMP-002-GRY', slot: 'Lighting', position: 0 },
        { productSlug: 'modular-bamboo-storage-shelf', variantSku: 'SHF-007-4T-WAL', slot: 'Storage', position: 1 },
      ],
    },
    {
      title: 'Spa-Inspired Bath Bundle',
      slug: 'spa-inspired-bath-bundle',
      type: CollectionType.BUNDLE,
      description: 'Calming scents and soft linens for a spa-like bathroom.',
      metadata: { roomType: 'Bathroom' },
      items: [
        { productSlug: 'egyptian-cotton-bedsheet-set', variantSku: 'SHT-006-KG-SLT', slot: 'Linens', position: 0 },
        { productSlug: 'ultrasonic-cool-mist-aromatherapy-diffuser', variantSku: 'DIF-001-WHT', slot: 'Accent', position: 1 },
      ],
    },
  ],
  [TENANT_IDS.OUTDOOR]: [
    {
      title: 'Weekend Backpacking Bundle',
      slug: 'weekend-backpacking-bundle',
      type: CollectionType.BUNDLE,
      description: 'Everything needed for a 2-day backpacking trip.',
      metadata: { climate: 'Mild', season: '3-Season' },
      items: [
        { productSlug: '3-season-backpacking-tent-2-person', variantSku: 'TNT-003-ORG', slot: 'Shelter', position: 0 },
        { productSlug: 'all-terrain-hiking-backpack-28l', variantSku: 'PCK-004-GRP', slot: 'Pack', position: 1 },
        { productSlug: 'carbon-fiber-trekking-poles-pair', variantSku: 'POL-005-BLKRED', slot: 'Poles', position: 2, isOptional: true },
      ],
    },
    {
      title: 'Trail Ready Hiking Setup',
      slug: 'trail-ready-hiking-setup',
      type: CollectionType.SETUP,
      description: 'Pack, poles and hydration for day hikes.',
      items: [
        { productSlug: 'all-terrain-hiking-backpack-28l', variantSku: 'PCK-004-MSS', slot: 'Pack', position: 0 },
        { productSlug: 'carbon-fiber-trekking-poles-pair', variantSku: 'POL-005-SLVBLU', slot: 'Poles', position: 1 },
        { productSlug: 'double-wall-vacuum-insulated-bottle-32oz', variantSku: 'BOT-001-BLK', slot: 'Hydration', position: 2 },
      ],
    },
    {
      title: 'Cycling Essentials Bundle',
      slug: 'cycling-essentials-bundle',
      type: CollectionType.BUNDLE,
      description: 'Ride-day apparel and hydration essentials.',
      items: [
        { productSlug: 'quick-dry-performance-cycling-jersey', variantSku: 'JER-006-BLU-M', slot: 'Apparel', position: 0 },
        { productSlug: 'double-wall-vacuum-insulated-bottle-32oz', variantSku: 'BOT-001-GRN', slot: 'Hydration', position: 1 },
      ],
    },
    {
      title: 'Paddle Day Bundle',
      slug: 'paddle-day-bundle',
      type: CollectionType.BUNDLE,
      description: 'Board and hydration essentials for a day on the water.',
      items: [
        { productSlug: 'inflatable-stand-up-paddleboard-10ft', variantSku: 'SUP-007-TEAL', slot: 'Board', position: 0 },
        { productSlug: 'double-wall-vacuum-insulated-bottle-32oz', variantSku: 'BOT-001-BLK', slot: 'Hydration', position: 1 },
      ],
    },
    {
      title: 'Yoga & Recovery Setup',
      slug: 'yoga-recovery-setup',
      type: CollectionType.SETUP,
      description: 'Mat and hydration essentials for outdoor practice.',
      items: [
        { productSlug: 'anti-slip-professional-yoga-mat-6mm', variantSku: 'YOGA-002-PRP', slot: 'Mat', position: 0 },
        { productSlug: 'double-wall-vacuum-insulated-bottle-32oz', variantSku: 'BOT-001-GRN', slot: 'Hydration', position: 1 },
      ],
    },
  ],
};

export async function seedCollections(prisma: PrismaClient) {
  process.stdout.write('🌱 Seeding Catalog Collections for 5 Tenants...\n');

  for (const [tenantId, collections] of Object.entries(COLLECTIONS_BY_TENANT)) {
    for (const colDef of collections) {
      const collection = await prisma.catalogCollection.upsert({
        where: { tenantId_slug: { tenantId, slug: colDef.slug } },
        update: {
          title: colDef.title,
          description: colDef.description,
          type: colDef.type,
          metadata: colDef.metadata,
        },
        create: {
          tenantId,
          title: colDef.title,
          slug: colDef.slug,
          type: colDef.type,
          description: colDef.description,
          metadata: colDef.metadata,
          isPublic: true,
        },
      });

      for (const itemDef of colDef.items) {
        const product = await prisma.catalogProduct.findUnique({
          where: { tenantId_slug: { tenantId, slug: itemDef.productSlug } },
        });
        if (!product) {
          process.stderr.write(
            `⚠️ Product [${itemDef.productSlug}] not found for tenant [${tenantId}]. Skipping collection item.\n`,
          );
          continue;
        }

        const variant = itemDef.variantSku
          ? await prisma.catalogProductVariant.findUnique({
              where: { tenantId_sku: { tenantId, sku: itemDef.variantSku } },
            })
          : null;

        const existingItem = await prisma.catalogCollectionItem.findFirst({
          where: { collectionId: collection.id, productId: product.id, slot: itemDef.slot },
        });

        if (!existingItem) {
          await prisma.catalogCollectionItem.create({
            data: {
              collectionId: collection.id,
              productId: product.id,
              productVariantId: variant?.id || null,
              slot: itemDef.slot,
              position: itemDef.position,
              isOptional: itemDef.isOptional ?? false,
            },
          });
        }
      }
    }
  }

  process.stdout.write('✅ Seeded Catalog Collections for all tenants!\n');
}

export default seedCollections;
