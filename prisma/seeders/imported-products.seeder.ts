import { PrismaClient, SyncStatus, ProductStatus, MediaType } from '@prisma/client';
import { TENANT_IDS } from './tenants.seeder';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function seedImportedProducts(prisma: PrismaClient) {
  process.stdout.write('📦 Seeding Expanded Catalog & Category-Mapped Products in v2-api...\n');

  // 1. Ensure Suppliers exist
  const cjSupplierId = '7d890123-4567-4890-a123-456789abcdef';
  const cjSupplier = await prisma.supplier.upsert({
    where: { id: cjSupplierId },
    update: { isActive: true },
    create: {
      id: cjSupplierId,
      name: 'CJ_DROPSHIPPING',
      displayName: 'CJ Dropshipping Official',
      isActive: true,
      config: {
        baseUrl: 'https://developers.cjdropshipping.com/api2.0/v1',
        rateLimitMs: 1500,
      },
    },
  });

  const aliSupplierId = '8a901234-5678-4901-b234-567890abcdef';
  await prisma.supplier.upsert({
    where: { id: aliSupplierId },
    update: { isActive: true },
    create: {
      id: aliSupplierId,
      name: 'ALI_EXPRESS',
      displayName: 'AliExpress Direct',
      isActive: true,
    },
  });

  // Helper function to resolve or create category under tenant
  async function resolveCategory(tenantId: string, categoryName: string): Promise<string> {
    const slug = slugify(categoryName);

    // Try finding existing category by name or slug under this tenant
    const existing = await prisma.category.findFirst({
      where: {
        tenantId,
        OR: [
          { slug: { contains: slug, mode: 'insensitive' } },
          { name: { contains: categoryName, mode: 'insensitive' } },
        ],
      },
    });

    if (existing) return existing.id;

    // Create new category if not found
    const created = await prisma.category.upsert({
      where: { tenantId_slug: { tenantId, slug } },
      update: { name: categoryName },
      create: {
        tenantId,
        name: categoryName,
        slug,
      },
    });

    return created.id;
  }

  // 2. Comprehensive catalog dataset spanning multiple tenants and categories
  const catalogDataset = [
    // --- ELECTRONICS & TECH ---
    {
      tenantId: TENANT_IDS.ELECTRONICS,
      categoryName: 'Gaming Accessories',
      externalId: 'CJ-PID-ELEC-101',
      externalSku: 'CJ-SKU-GAME-MOUSE',
      title: 'Ergonomic RGB Wireless Gaming Mouse',
      slug: 'ergonomic-rgb-wireless-gaming-mouse',
      description: 'High precision 16000 DPI rechargeable gaming mouse with 7-mode RGB illumination and lag-free wireless technology.',
      costPrice: 8.50,
      sellingPrice: 29.99,
      shippingEstimate: 3.50,
      imageUrl: 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7',
      variants: [
        { externalId: 'CJ-VAR-101-A', sku: 'GM-101-BLK', title: 'Matte Black / 16000 DPI', costPrice: 8.50, sellingPrice: 29.99, stock: 450 },
        { externalId: 'CJ-VAR-101-B', sku: 'GM-101-WHT', title: 'Cyber White / 16000 DPI', costPrice: 9.00, sellingPrice: 31.99, stock: 300 },
      ],
      rawData: { productNameEn: 'Ergonomic RGB Wireless Gaming Mouse', categoryName: 'Gaming Accessories', weight: '0.25kg', score: 9.2, verdict: 'SELL' },
    },
    {
      tenantId: TENANT_IDS.ELECTRONICS,
      categoryName: 'Audio',
      externalId: 'CJ-PID-ELEC-102',
      externalSku: 'CJ-SKU-HEAD-ANC',
      title: 'Active Noise Cancelling Wireless Headphones',
      slug: 'active-noise-cancelling-wireless-headphones',
      description: 'Premium over-ear Bluetooth headphones with 40-hour battery life, active noise cancellation, and high-res audio drivers.',
      costPrice: 28.00,
      sellingPrice: 79.50,
      shippingEstimate: 5.00,
      imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e',
      variants: [
        { externalId: 'CJ-VAR-102-A', sku: 'ANC-102-BLK', title: 'Midnight Black', costPrice: 28.00, sellingPrice: 79.50, stock: 120 },
        { externalId: 'CJ-VAR-102-B', sku: 'ANC-102-SLV', title: 'Silver Platinum', costPrice: 29.50, sellingPrice: 84.99, stock: 95 },
      ],
      rawData: { productNameEn: 'Active Noise Cancelling Wireless Headphones', categoryName: 'Audio', weight: '0.45kg', score: 8.5, verdict: 'SELL' },
    },
    {
      tenantId: TENANT_IDS.ELECTRONICS,
      categoryName: 'Computer Peripherals',
      externalId: 'CJ-PID-ELEC-103',
      externalSku: 'CJ-SKU-KEY-MECH',
      title: 'Compact 75% Mechanical RGB Keyboard',
      slug: 'compact-75-mechanical-rgb-keyboard',
      description: 'Hot-swappable mechanical keyboard with custom lubricated switches, PBT keycaps, and tri-mode connectivity (Bluetooth/2.4G/Type-C).',
      costPrice: 22.50,
      sellingPrice: 59.99,
      shippingEstimate: 4.20,
      imageUrl: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3',
      variants: [
        { externalId: 'CJ-VAR-103-A', sku: 'KB-103-RED', title: 'Red Linear Switch / Grey', costPrice: 22.50, sellingPrice: 59.99, stock: 200 },
        { externalId: 'CJ-VAR-103-B', sku: 'KB-103-BRN', title: 'Brown Tactile Switch / White', costPrice: 23.00, sellingPrice: 62.99, stock: 180 },
      ],
      rawData: { productNameEn: 'Compact 75% Mechanical RGB Keyboard', categoryName: 'Computer Peripherals', weight: '0.75kg', score: 8.9, verdict: 'SELL' },
    },
    {
      tenantId: TENANT_IDS.ELECTRONICS,
      categoryName: 'Cameras & Optics',
      externalId: 'CJ-PID-ELEC-104',
      externalSku: 'CJ-SKU-CAM-4K',
      title: 'Ultra HD 4K Streaming Webcam with Ring Light',
      slug: 'ultra-hd-4k-streaming-webcam-ring-light',
      description: 'Auto-focus 4K webcam with dual noise-reducing microphones and built-in 3-level adjustable LED ring light for video calls and streaming.',
      costPrice: 16.00,
      sellingPrice: 49.99,
      shippingEstimate: 3.00,
      imageUrl: 'https://images.unsplash.com/photo-1585060544812-6b45742d762f',
      variants: [
        { externalId: 'CJ-VAR-104-A', sku: 'CAM-104-BLK', title: 'Matte Black 4K', costPrice: 16.00, sellingPrice: 49.99, stock: 310 },
      ],
      rawData: { productNameEn: 'Ultra HD 4K Streaming Webcam', categoryName: 'Cameras & Optics', weight: '0.30kg', score: 7.8, verdict: 'TEST' },
    },

    // --- FASHION & APPAREL ---
    {
      tenantId: TENANT_IDS.FASHION,
      categoryName: 'Footwear',
      externalId: 'CJ-PID-FASH-201',
      externalSku: 'CJ-SKU-SNEAK-AIR',
      title: 'Urban Air Cushion Breathable Running Sneakers',
      slug: 'urban-air-cushion-breathable-running-sneakers',
      description: 'Ultra-lightweight mesh athletic sneakers with shock-absorbing air cushion heel for maximum daily comfort.',
      costPrice: 18.00,
      sellingPrice: 59.99,
      shippingEstimate: 4.50,
      imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff',
      variants: [
        { externalId: 'CJ-VAR-201-A', sku: 'SNK-201-BLK-42', title: 'Black / Size 42', costPrice: 18.00, sellingPrice: 59.99, stock: 150 },
        { externalId: 'CJ-VAR-201-B', sku: 'SNK-201-RED-43', title: 'Crimson Red / Size 43', costPrice: 18.00, sellingPrice: 59.99, stock: 120 },
      ],
      rawData: { productNameEn: 'Urban Air Cushion Running Sneakers', categoryName: 'Footwear', weight: '0.65kg', score: 9.0, verdict: 'SELL' },
    },
    {
      tenantId: TENANT_IDS.FASHION,
      categoryName: 'Apparel',
      externalId: 'CJ-PID-FASH-202',
      externalSku: 'CJ-SKU-HOODIE-OVER',
      title: 'Heavyweight Fleece Oversized Streetwear Hoodie',
      slug: 'heavyweight-fleece-oversized-streetwear-hoodie',
      description: '450GSM cotton blend French terry fleece oversized hoodie with drop-shoulder fit and double-layered hood.',
      costPrice: 15.50,
      sellingPrice: 48.00,
      shippingEstimate: 4.00,
      imageUrl: 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2',
      variants: [
        { externalId: 'CJ-VAR-202-A', sku: 'HD-202-GRY-L', title: 'Heather Grey / Large', costPrice: 15.50, sellingPrice: 48.00, stock: 250 },
        { externalId: 'CJ-VAR-202-B', sku: 'HD-202-BLK-XL', title: 'Washed Black / XL', costPrice: 15.50, sellingPrice: 48.00, stock: 210 },
      ],
      rawData: { productNameEn: 'Heavyweight Fleece Oversized Hoodie', categoryName: 'Apparel', weight: '0.70kg', score: 8.7, verdict: 'SELL' },
    },

    // --- HEALTH & WELLNESS ---
    {
      tenantId: TENANT_IDS.HEALTH_WELLNESS,
      categoryName: 'Wearables',
      externalId: 'CJ-PID-HLTH-301',
      externalSku: 'CJ-SKU-WATCH-FIT',
      title: 'Smart Fitness Tracker with SpO2 & Heart Rate Monitor',
      slug: 'smart-fitness-tracker-spo2-heart-rate',
      description: 'Waterproof smartwatch monitoring 24/7 heart rate, blood oxygen levels, sleep stages, and 30+ sport modes.',
      costPrice: 14.20,
      sellingPrice: 45.00,
      shippingEstimate: 2.80,
      imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30',
      variants: [
        { externalId: 'CJ-VAR-301-A', sku: 'FIT-301-BLK', title: 'Graphite Black Strap', costPrice: 14.20, sellingPrice: 45.00, stock: 210 },
      ],
      rawData: { productNameEn: 'Smart Fitness Tracker with SpO2 Sensor', categoryName: 'Wearables', weight: '0.15kg', score: 7.4, verdict: 'TEST' },
    },
    {
      tenantId: TENANT_IDS.HEALTH_WELLNESS,
      categoryName: 'Fitness Equipment',
      externalId: 'CJ-PID-HLTH-302',
      externalSku: 'CJ-SKU-GUN-MASSAGE',
      title: 'Deep Tissue Percussion Muscle Massage Gun',
      slug: 'deep-tissue-percussion-muscle-massage-gun',
      description: 'Quiet brushless motor massage gun with 30 speed levels and 6 interchangeable massage heads for athletic recovery.',
      costPrice: 19.50,
      sellingPrice: 65.00,
      shippingEstimate: 3.80,
      imageUrl: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b',
      variants: [
        { externalId: 'CJ-VAR-302-A', sku: 'MSG-302-BLK', title: 'Matte Black Pro Edition', costPrice: 19.50, sellingPrice: 65.00, stock: 175 },
      ],
      rawData: { productNameEn: 'Deep Tissue Massage Gun', categoryName: 'Fitness Equipment', weight: '0.90kg', score: 8.8, verdict: 'SELL' },
    },

    // --- HOME & GARDEN ---
    {
      tenantId: TENANT_IDS.HOME_GARDEN,
      categoryName: 'Home Decor',
      externalId: 'CJ-PID-HOME-401',
      externalSku: 'CJ-SKU-DIFF-HUMID',
      title: 'Ultrasonic Cool Mist Aromatherapy Diffuser 500ml',
      slug: 'ultrasonic-cool-mist-aromatherapy-diffuser-500ml',
      description: 'Whisper-quiet essential oil diffuser with 7 ambient LED light settings and auto waterless shut-off feature.',
      costPrice: 9.80,
      sellingPrice: 32.99,
      shippingEstimate: 3.20,
      imageUrl: 'https://images.unsplash.com/photo-1585771724684-38269d6639fd',
      variants: [
        { externalId: 'CJ-VAR-401-A', sku: 'DIF-401-WOD', title: 'Natural Grain Wood', costPrice: 9.80, sellingPrice: 32.99, stock: 400 },
      ],
      rawData: { productNameEn: 'Ultrasonic Cool Mist Aromatherapy Diffuser', categoryName: 'Home Decor', weight: '0.40kg', score: 8.3, verdict: 'SELL' },
    },
    {
      tenantId: TENANT_IDS.HOME_GARDEN,
      categoryName: 'Lighting',
      externalId: 'CJ-PID-HOME-402',
      externalSku: 'CJ-SKU-LAMP-DESK',
      title: 'Dimmable LED Desk Lamp with Wireless Charging Pad',
      slug: 'dimmable-led-desk-lamp-wireless-charging',
      description: 'Modern minimalist desk lamp with 5 color temperatures, touch slider control, and 10W wireless smartphone charger base.',
      costPrice: 12.40,
      sellingPrice: 39.99,
      shippingEstimate: 3.10,
      imageUrl: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c',
      variants: [
        { externalId: 'CJ-VAR-402-A', sku: 'LMP-402-WHT', title: 'Nordic White', costPrice: 12.40, sellingPrice: 39.99, stock: 220 },
      ],
      rawData: { productNameEn: 'Dimmable LED Desk Lamp', categoryName: 'Lighting', weight: '0.55kg', score: 8.1, verdict: 'SELL' },
    },

    // --- BEAUTY & PERSONAL CARE ---
    {
      tenantId: TENANT_IDS.BEAUTY,
      categoryName: 'Skincare Tools',
      externalId: 'CJ-PID-BEAUT-501',
      externalSku: 'CJ-SKU-CLEAN-FACIAL',
      title: 'Waterproof Sonic Facial Cleansing Brush',
      slug: 'waterproof-sonic-facial-cleansing-brush',
      description: 'Hygienic food-grade silicone facial scrubber with 8 vibration intensities for deep pore cleansing and exfoliation.',
      costPrice: 6.20,
      sellingPrice: 24.99,
      shippingEstimate: 2.10,
      imageUrl: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e',
      variants: [
        { externalId: 'CJ-VAR-501-A', sku: 'FAC-501-PNK', title: 'Rose Pink', costPrice: 6.20, sellingPrice: 24.99, stock: 600 },
      ],
      rawData: { productNameEn: 'Sonic Facial Cleansing Brush', categoryName: 'Skincare Tools', weight: '0.12kg', score: 8.6, verdict: 'SELL' },
    },

    // --- SPORTS & OUTDOORS ---
    {
      tenantId: TENANT_IDS.SPORTS_OUTDOORS,
      categoryName: 'Outdoor Gear',
      externalId: 'CJ-PID-SPRT-601',
      externalSku: 'CJ-SKU-BOT-VACUUM',
      title: 'Double-Wall Vacuum Insulated Stainless Steel Bottle 32oz',
      slug: 'double-wall-vacuum-insulated-bottle-32oz',
      description: 'Leakproof sports water bottle keeping drinks ice cold for 24 hours or piping hot for 12 hours.',
      costPrice: 7.50,
      sellingPrice: 27.99,
      shippingEstimate: 2.90,
      imageUrl: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8',
      variants: [
        { externalId: 'CJ-VAR-601-A', sku: 'BOT-601-BLK', title: 'Matte Black 32oz', costPrice: 7.50, sellingPrice: 27.99, stock: 380 },
      ],
      rawData: { productNameEn: 'Vacuum Insulated Stainless Steel Bottle', categoryName: 'Outdoor Gear', weight: '0.35kg', score: 8.4, verdict: 'SELL' },
    },
  ];

  let importedCount = 0;

  for (const item of catalogDataset) {
    // A. Resolve or link Category for this tenant
    const categoryId = await resolveCategory(item.tenantId, item.categoryName);

    // B. Seed Store Catalog Product & Variants linked to categoryId
    const product = await prisma.product.upsert({
      where: { tenantId_slug: { tenantId: item.tenantId, slug: item.slug } },
      update: {
        title: item.title,
        description: item.description,
        categoryId,
        status: ProductStatus.PUBLISHED,
        featured: true,
      },
      create: {
        tenantId: item.tenantId,
        categoryId,
        title: item.title,
        slug: item.slug,
        description: item.description,
        status: ProductStatus.PUBLISHED,
        featured: true,
        media: {
          create: [
            {
              url: item.imageUrl,
              type: MediaType.IMAGE,
              altText: item.title,
              isPrimary: true,
              position: 0,
            },
          ],
        },
      },
    });

    // C. Seed Raw SupplierProduct record linked to CJ Dropshipping
    const supplierProduct = await prisma.supplierProduct.upsert({
      where: {
        supplierId_externalId: {
          supplierId: cjSupplier.id,
          externalId: item.externalId,
        },
      },
      update: {
        productId: product.id,
        costPrice: item.costPrice,
        shippingEstimate: item.shippingEstimate,
        syncStatus: SyncStatus.SUCCESS,
        lastSyncedAt: new Date(),
        rawData: item.rawData,
      },
      create: {
        supplierId: cjSupplier.id,
        productId: product.id,
        externalId: item.externalId,
        externalSku: item.externalSku,
        costPrice: item.costPrice,
        shippingEstimate: item.shippingEstimate,
        syncStatus: SyncStatus.SUCCESS,
        lastSyncedAt: new Date(),
        rawData: item.rawData,
      },
    });

    // D. Seed ProductVariants & SupplierVariants
    for (const v of item.variants) {
      const productVariant = await prisma.productVariant.upsert({
        where: { tenantId_sku: { tenantId: item.tenantId, sku: v.sku } },
        update: {
          price: v.sellingPrice,
          baseCost: v.costPrice,
          sellingPrice: v.sellingPrice,
          calculatedPrice: v.sellingPrice,
          stock: v.stock,
        },
        create: {
          tenantId: item.tenantId,
          productId: product.id,
          sku: v.sku,
          title: v.title,
          price: v.sellingPrice,
          baseCost: v.costPrice,
          sellingPrice: v.sellingPrice,
          calculatedPrice: v.sellingPrice,
          stock: v.stock,
        },
      });

      await prisma.supplierVariant.upsert({
        where: {
          supplierProductId_externalId: {
            supplierProductId: supplierProduct.id,
            externalId: v.externalId,
          },
        },
        update: {
          productVariantId: productVariant.id,
          costPrice: v.costPrice,
          stock: v.stock,
          syncStatus: SyncStatus.SUCCESS,
          lastSyncedAt: new Date(),
          rawData: { sku: v.sku, title: v.title },
        },
        create: {
          supplierProductId: supplierProduct.id,
          productVariantId: productVariant.id,
          externalId: v.externalId,
          costPrice: v.costPrice,
          stock: v.stock,
          syncStatus: SyncStatus.SUCCESS,
          lastSyncedAt: new Date(),
          rawData: { sku: v.sku, title: v.title },
        },
      });
    }

    importedCount++;
    process.stdout.write(`  ✓ Product [${product.id}] -> Category [${categoryId}] (${item.categoryName}) for Tenant [${item.tenantId}]: ${product.title}\n`);
  }

  // 3. Seed SupplierSyncLog & SupplierStatistic
  await prisma.supplierSyncLog.create({
    data: {
      supplierId: cjSupplier.id,
      action: 'SYNC_PRODUCTS',
      status: SyncStatus.SUCCESS,
      recordsProcessed: importedCount,
      details: { importedCount, provider: 'CJ_DROPSHIPPING' },
      completedAt: new Date(),
    },
  });

  await prisma.supplierStatistic.upsert({
    where: { tenantId_supplierId: { tenantId: TENANT_IDS.FASHION, supplierId: cjSupplier.id } },
    update: {
      productsImported: importedCount,
      updatedAt: new Date(),
    },
    create: {
      tenantId: TENANT_IDS.FASHION,
      supplierId: cjSupplier.id,
      productsImported: importedCount,
      totalOrders: 12,
      totalRevenue: 1450.00,
    },
  });

  process.stdout.write(`🎉 Full Catalog & Category Mapping Completed! Seeded ${importedCount} products cleanly linked to categories in v2-api.\n`);
}

export default seedImportedProducts;
