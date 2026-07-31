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
  const cjSupplier = await prisma.supplierPartner.upsert({
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
  await prisma.supplierPartner.upsert({
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
    const existing = await prisma.catalogCategory.findFirst({
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
    const created = await prisma.catalogCategory.upsert({
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
      description:
        'High precision 16000 DPI rechargeable gaming mouse with 7-mode RGB illumination and lag-free wireless technology.',
      costPrice: 8.5,
      sellingPrice: 29.99,
      shippingEstimate: 3.5,
      imageUrl: 'https://images.unsplash.com/photo-1616400619175-5beda3a17896?w=800&q=80',
      variants: [
        {
          externalId: 'CJ-VAR-101-A',
          sku: 'GM-101-BLK',
          title: 'Matte Black / 16000 DPI',
          costPrice: 8.5,
          sellingPrice: 29.99,
          stock: 450,
        },
        {
          externalId: 'CJ-VAR-101-B',
          sku: 'GM-101-WHT',
          title: 'Cyber White / 16000 DPI',
          costPrice: 9.0,
          sellingPrice: 31.99,
          stock: 300,
        },
      ],
      rawData: {
        productNameEn: 'Ergonomic RGB Wireless Gaming Mouse',
        categoryName: 'Gaming Accessories',
        weight: '0.25kg',
        score: 9.2,
        verdict: 'SELL',
      },
    },
    {
      tenantId: TENANT_IDS.ELECTRONICS,
      categoryName: 'Audio',
      externalId: 'CJ-PID-ELEC-102',
      externalSku: 'CJ-SKU-HEAD-ANC',
      title: 'Active Noise Cancelling Wireless Headphones',
      slug: 'active-noise-cancelling-wireless-headphones',
      description:
        'Premium over-ear Bluetooth headphones with 40-hour battery life, active noise cancellation, and high-res audio drivers.',
      costPrice: 28.0,
      sellingPrice: 79.5,
      shippingEstimate: 5.0,
      imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80',
      variants: [
        {
          externalId: 'CJ-VAR-102-A',
          sku: 'ANC-102-BLK',
          title: 'Midnight Black',
          costPrice: 28.0,
          sellingPrice: 79.5,
          stock: 120,
        },
        {
          externalId: 'CJ-VAR-102-B',
          sku: 'ANC-102-SLV',
          title: 'Silver Platinum',
          costPrice: 29.5,
          sellingPrice: 84.99,
          stock: 95,
        },
      ],
      rawData: {
        productNameEn: 'Active Noise Cancelling Wireless Headphones',
        categoryName: 'Audio',
        weight: '0.45kg',
        score: 8.5,
        verdict: 'SELL',
      },
    },
    {
      tenantId: TENANT_IDS.ELECTRONICS,
      categoryName: 'Computer Peripherals',
      externalId: 'CJ-PID-ELEC-103',
      externalSku: 'CJ-SKU-KEY-MECH',
      title: 'Compact 75% Mechanical RGB Keyboard',
      slug: 'compact-75-mechanical-rgb-keyboard',
      description:
        'Hot-swappable mechanical keyboard with custom lubricated switches, PBT keycaps, and tri-mode connectivity (Bluetooth/2.4G/Type-C).',
      costPrice: 22.5,
      sellingPrice: 59.99,
      shippingEstimate: 4.2,
      imageUrl: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&q=80',
      variants: [
        {
          externalId: 'CJ-VAR-103-A',
          sku: 'KB-103-RED',
          title: 'Red Linear Switch / Grey',
          costPrice: 22.5,
          sellingPrice: 59.99,
          stock: 200,
        },
        {
          externalId: 'CJ-VAR-103-B',
          sku: 'KB-103-BRN',
          title: 'Brown Tactile Switch / White',
          costPrice: 23.0,
          sellingPrice: 62.99,
          stock: 180,
        },
      ],
      rawData: {
        productNameEn: 'Compact 75% Mechanical RGB Keyboard',
        categoryName: 'Computer Peripherals',
        weight: '0.75kg',
        score: 8.9,
        verdict: 'SELL',
      },
    },
    {
      tenantId: TENANT_IDS.ELECTRONICS,
      categoryName: 'Cameras & Optics',
      externalId: 'CJ-PID-ELEC-104',
      externalSku: 'CJ-SKU-CAM-4K',
      title: 'Ultra HD 4K Streaming Webcam with Ring Light',
      slug: 'ultra-hd-4k-streaming-webcam-ring-light',
      description:
        'Auto-focus 4K webcam with dual noise-reducing microphones and built-in 3-level adjustable LED ring light for video calls and streaming.',
      costPrice: 16.0,
      sellingPrice: 49.99,
      shippingEstimate: 3.0,
      imageUrl: 'https://images.unsplash.com/photo-1596003906949-67221c37965c?w=800&q=80',
      variants: [
        {
          externalId: 'CJ-VAR-104-A',
          sku: 'CAM-104-BLK',
          title: 'Matte Black 4K',
          costPrice: 16.0,
          sellingPrice: 49.99,
          stock: 310,
        },
      ],
      rawData: {
        productNameEn: 'Ultra HD 4K Streaming Webcam',
        categoryName: 'Cameras & Optics',
        weight: '0.30kg',
        score: 7.8,
        verdict: 'TEST',
      },
    },

    // --- FASHION & APPAREL ---
    {
      tenantId: TENANT_IDS.FASHION,
      categoryName: 'Footwear',
      externalId: 'CJ-PID-FASH-201',
      externalSku: 'CJ-SKU-SNEAK-AIR',
      title: 'Urban Air Cushion Breathable Running Sneakers',
      slug: 'urban-air-cushion-breathable-running-sneakers',
      description:
        'Ultra-lightweight mesh athletic sneakers with shock-absorbing air cushion heel for maximum daily comfort.',
      costPrice: 18.0,
      sellingPrice: 59.99,
      shippingEstimate: 4.5,
      imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80',
      variants: [
        {
          externalId: 'CJ-VAR-201-A',
          sku: 'SNK-201-BLK-42',
          title: 'Black / Size 42',
          costPrice: 18.0,
          sellingPrice: 59.99,
          stock: 150,
        },
        {
          externalId: 'CJ-VAR-201-B',
          sku: 'SNK-201-RED-43',
          title: 'Crimson Red / Size 43',
          costPrice: 18.0,
          sellingPrice: 59.99,
          stock: 120,
        },
      ],
      rawData: {
        productNameEn: 'Urban Air Cushion Running Sneakers',
        categoryName: 'Footwear',
        weight: '0.65kg',
        score: 9.0,
        verdict: 'SELL',
      },
    },
    {
      tenantId: TENANT_IDS.FASHION,
      categoryName: 'Apparel',
      externalId: 'CJ-PID-FASH-202',
      externalSku: 'CJ-SKU-HOODIE-OVER',
      title: 'Heavyweight Fleece Oversized Streetwear Hoodie',
      slug: 'heavyweight-fleece-oversized-streetwear-hoodie',
      description:
        '450GSM cotton blend French terry fleece oversized hoodie with drop-shoulder fit and double-layered hood.',
      costPrice: 15.5,
      sellingPrice: 48.0,
      shippingEstimate: 4.0,
      imageUrl: 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=800&q=80',
      variants: [
        {
          externalId: 'CJ-VAR-202-A',
          sku: 'HD-202-GRY-L',
          title: 'Heather Grey / Large',
          costPrice: 15.5,
          sellingPrice: 48.0,
          stock: 250,
        },
        {
          externalId: 'CJ-VAR-202-B',
          sku: 'HD-202-BLK-XL',
          title: 'Washed Black / XL',
          costPrice: 15.5,
          sellingPrice: 48.0,
          stock: 210,
        },
      ],
      rawData: {
        productNameEn: 'Heavyweight Fleece Oversized Hoodie',
        categoryName: 'Apparel',
        weight: '0.70kg',
        score: 8.7,
        verdict: 'SELL',
      },
    },

    // --- HEALTH & WELLNESS ---
    {
      tenantId: TENANT_IDS.HEALTH_WELLNESS,
      categoryName: 'Wearables',
      externalId: 'CJ-PID-HLTH-301',
      externalSku: 'CJ-SKU-WATCH-FIT',
      title: 'Smart Fitness Tracker with SpO2 & Heart Rate Monitor',
      slug: 'smart-fitness-tracker-spo2-heart-rate',
      description:
        'Waterproof smartwatch monitoring 24/7 heart rate, blood oxygen levels, sleep stages, and 30+ sport modes.',
      costPrice: 14.2,
      sellingPrice: 45.0,
      shippingEstimate: 2.8,
      imageUrl: 'https://images.unsplash.com/photo-1575311373937-040b8e1fd5b6?w=800&q=80',
      variants: [
        {
          externalId: 'CJ-VAR-301-A',
          sku: 'FIT-301-BLK',
          title: 'Graphite Black Strap',
          costPrice: 14.2,
          sellingPrice: 45.0,
          stock: 210,
        },
      ],
      rawData: {
        productNameEn: 'Smart Fitness Tracker with SpO2 Sensor',
        categoryName: 'Wearables',
        weight: '0.15kg',
        score: 7.4,
        verdict: 'TEST',
      },
    },
    {
      tenantId: TENANT_IDS.HEALTH_WELLNESS,
      categoryName: 'Fitness Equipment',
      externalId: 'CJ-PID-HLTH-302',
      externalSku: 'CJ-SKU-GUN-MASSAGE',
      title: 'Deep Tissue Percussion Muscle Massage Gun',
      slug: 'deep-tissue-percussion-muscle-massage-gun',
      description:
        'Quiet brushless motor massage gun with 30 speed levels and 6 interchangeable massage heads for athletic recovery.',
      costPrice: 19.5,
      sellingPrice: 65.0,
      shippingEstimate: 3.8,
      imageUrl: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800&q=80',
      variants: [
        {
          externalId: 'CJ-VAR-302-A',
          sku: 'MSG-302-BLK',
          title: 'Matte Black Pro Edition',
          costPrice: 19.5,
          sellingPrice: 65.0,
          stock: 175,
        },
      ],
      rawData: {
        productNameEn: 'Deep Tissue Massage Gun',
        categoryName: 'Fitness Equipment',
        weight: '0.90kg',
        score: 8.8,
        verdict: 'SELL',
      },
    },

    // --- HOME & GARDEN ---
    {
      tenantId: TENANT_IDS.HOME_GARDEN,
      categoryName: 'Home Decor',
      externalId: 'CJ-PID-HOME-401',
      externalSku: 'CJ-SKU-DIFF-HUMID',
      title: 'Ultrasonic Cool Mist Aromatherapy Diffuser 500ml',
      slug: 'ultrasonic-cool-mist-aromatherapy-diffuser-500ml',
      description:
        'Whisper-quiet essential oil diffuser with 7 ambient LED light settings and auto waterless shut-off feature.',
      costPrice: 9.8,
      sellingPrice: 32.99,
      shippingEstimate: 3.2,
      imageUrl: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&q=80',
      variants: [
        {
          externalId: 'CJ-VAR-401-A',
          sku: 'DIF-401-WOD',
          title: 'Natural Grain Wood',
          costPrice: 9.8,
          sellingPrice: 32.99,
          stock: 400,
        },
      ],
      rawData: {
        productNameEn: 'Ultrasonic Cool Mist Aromatherapy Diffuser',
        categoryName: 'Home Decor',
        weight: '0.40kg',
        score: 8.3,
        verdict: 'SELL',
      },
    },
    {
      tenantId: TENANT_IDS.HOME_GARDEN,
      categoryName: 'Lighting',
      externalId: 'CJ-PID-HOME-402',
      externalSku: 'CJ-SKU-LAMP-DESK',
      title: 'Dimmable LED Desk Lamp with Wireless Charging Pad',
      slug: 'dimmable-led-desk-lamp-wireless-charging',
      description:
        'Modern minimalist desk lamp with 5 color temperatures, touch slider control, and 10W wireless smartphone charger base.',
      costPrice: 12.4,
      sellingPrice: 39.99,
      shippingEstimate: 3.1,
      imageUrl: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=800&q=80',
      variants: [
        {
          externalId: 'CJ-VAR-402-A',
          sku: 'LMP-402-WHT',
          title: 'Nordic White',
          costPrice: 12.4,
          sellingPrice: 39.99,
          stock: 220,
        },
      ],
      rawData: {
        productNameEn: 'Dimmable LED Desk Lamp',
        categoryName: 'Lighting',
        weight: '0.55kg',
        score: 8.1,
        verdict: 'SELL',
      },
    },

    // --- BEAUTY & PERSONAL CARE ---
    {
      tenantId: TENANT_IDS.BEAUTY,
      categoryName: 'Skincare Tools',
      externalId: 'CJ-PID-BEAUT-501',
      externalSku: 'CJ-SKU-CLEAN-FACIAL',
      title: 'Waterproof Sonic Facial Cleansing Brush',
      slug: 'waterproof-sonic-facial-cleansing-brush',
      description:
        'Hygienic food-grade silicone facial scrubber with 8 vibration intensities for deep pore cleansing and exfoliation.',
      costPrice: 6.2,
      sellingPrice: 24.99,
      shippingEstimate: 2.1,
      imageUrl: 'https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=800&q=80',
      variants: [
        {
          externalId: 'CJ-VAR-501-A',
          sku: 'FAC-501-PNK',
          title: 'Rose Pink',
          costPrice: 6.2,
          sellingPrice: 24.99,
          stock: 600,
        },
      ],
      rawData: {
        productNameEn: 'Sonic Facial Cleansing Brush',
        categoryName: 'Skincare Tools',
        weight: '0.12kg',
        score: 8.6,
        verdict: 'SELL',
      },
    },

    // --- SPORTS & OUTDOORS ---
    {
      tenantId: TENANT_IDS.SPORTS_OUTDOORS,
      categoryName: 'Outdoor Gear',
      externalId: 'CJ-PID-SPRT-601',
      externalSku: 'CJ-SKU-BOT-VACUUM',
      title: 'Double-Wall Vacuum Insulated Stainless Steel Bottle 32oz',
      slug: 'double-wall-vacuum-insulated-bottle-32oz',
      description:
        'Leakproof sports water bottle keeping drinks ice cold for 24 hours or piping hot for 12 hours.',
      costPrice: 7.5,
      sellingPrice: 27.99,
      shippingEstimate: 2.9,
      imageUrl: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=800&q=80',
      variants: [
        {
          externalId: 'CJ-VAR-601-A',
          sku: 'BOT-601-BLK',
          title: 'Matte Black 32oz',
          costPrice: 7.5,
          sellingPrice: 27.99,
          stock: 380,
        },
      ],
      rawData: {
        productNameEn: 'Vacuum Insulated Stainless Steel Bottle',
        categoryName: 'Outdoor Gear',
        weight: '0.35kg',
        score: 8.4,
        verdict: 'SELL',
      },
    },

    // ============================================================
    // --- FASHION: COMPLETE OUTFIT SET (5 Pieces) ---
    // ============================================================
    {
      tenantId: TENANT_IDS.FASHION,
      categoryName: 'Tops',
      externalId: 'CJ-PID-FSH-301',
      externalSku: 'CJ-SKU-TOP-ESSENTIALS',
      title: 'Essential Relaxed Fit Oversized Graphic Tee',
      slug: 'essential-relaxed-fit-oversized-graphic-tee',
      description: 'Premium 300gsm heavyweight cotton tee with distressed graphic print. Boxy oversized cut.',
      costPrice: 6.8,
      sellingPrice: 22.99,
      shippingEstimate: 2.5,
      imageUrl: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800&q=80',
      variants: [
        { externalId: 'CJ-VAR-301-A', sku: 'TEE-301-WHT-S', title: 'White / Small', costPrice: 6.8, sellingPrice: 22.99, stock: 200 },
        { externalId: 'CJ-VAR-301-B', sku: 'TEE-301-WHT-M', title: 'White / Medium', costPrice: 6.8, sellingPrice: 22.99, stock: 350 },
        { externalId: 'CJ-VAR-301-C', sku: 'TEE-301-BLK-M', title: 'Black / Medium', costPrice: 6.8, sellingPrice: 22.99, stock: 280 },
      ],
      rawData: { productNameEn: 'Oversized Graphic Tee', categoryName: 'Tops', weight: '0.3kg', score: 8.7, verdict: 'SELL' },
    },
    {
      tenantId: TENANT_IDS.FASHION,
      categoryName: 'Bottoms',
      externalId: 'CJ-PID-FSH-302',
      externalSku: 'CJ-SKU-CARGO-PANTS',
      title: 'Tactical Relaxed Cargo Pants with Side Pockets',
      slug: 'tactical-relaxed-cargo-pants-side-pockets',
      description: 'Utilitarian cargo trousers in ripstop fabric. Wide-leg, adjustable drawstring hem.',
      costPrice: 14.5,
      sellingPrice: 45.99,
      shippingEstimate: 4.0,
      imageUrl: 'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=800&q=80',
      variants: [
        { externalId: 'CJ-VAR-302-A', sku: 'CGO-302-BLK-30', title: 'Black / W30', costPrice: 14.5, sellingPrice: 45.99, stock: 180 },
        { externalId: 'CJ-VAR-302-B', sku: 'CGO-302-OLV-32', title: 'Olive Green / W32', costPrice: 14.5, sellingPrice: 45.99, stock: 140 },
      ],
      rawData: { productNameEn: 'Cargo Pants', categoryName: 'Bottoms', weight: '0.6kg', score: 8.9, verdict: 'SELL' },
    },
    {
      tenantId: TENANT_IDS.FASHION,
      categoryName: 'Outerwear',
      externalId: 'CJ-PID-FSH-303',
      externalSku: 'CJ-SKU-BOMBER-JACKET',
      title: 'Y2K Satin Bomber Jacket with Embroidered Logo',
      slug: 'y2k-satin-bomber-jacket-embroidered-logo',
      description: 'Shiny satin bomber with ribbed cuffs, embroidered chest logo, and inner quilted lining.',
      costPrice: 22.0,
      sellingPrice: 69.99,
      shippingEstimate: 5.5,
      imageUrl: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=800&q=80',
      variants: [
        { externalId: 'CJ-VAR-303-A', sku: 'BMB-303-BLK-M', title: 'Black / Medium', costPrice: 22.0, sellingPrice: 69.99, stock: 120 },
        { externalId: 'CJ-VAR-303-B', sku: 'BMB-303-SLV-L', title: 'Silver / Large', costPrice: 22.0, sellingPrice: 69.99, stock: 90 },
      ],
      rawData: { productNameEn: 'Satin Bomber Jacket', categoryName: 'Outerwear', weight: '0.85kg', score: 9.1, verdict: 'SELL' },
    },
    {
      tenantId: TENANT_IDS.FASHION,
      categoryName: 'Accessories',
      externalId: 'CJ-PID-FSH-304',
      externalSku: 'CJ-SKU-STREETWEAR-CAP',
      title: '6-Panel Structured Streetwear Snapback Cap',
      slug: '6-panel-structured-streetwear-snapback-cap',
      description: 'Premium 6-panel cap with flat brim, metal clasp, and embroidered logo patch.',
      costPrice: 5.2,
      sellingPrice: 18.99,
      shippingEstimate: 1.8,
      imageUrl: 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=800&q=80',
      variants: [
        { externalId: 'CJ-VAR-304-A', sku: 'CAP-304-BLK', title: 'Black / One Size', costPrice: 5.2, sellingPrice: 18.99, stock: 400 },
        { externalId: 'CJ-VAR-304-B', sku: 'CAP-304-WHT', title: 'White / One Size', costPrice: 5.2, sellingPrice: 18.99, stock: 320 },
      ],
      rawData: { productNameEn: 'Snapback Cap', categoryName: 'Accessories', weight: '0.15kg', score: 8.5, verdict: 'SELL' },
    },
    {
      tenantId: TENANT_IDS.FASHION,
      categoryName: 'Bags',
      externalId: 'CJ-PID-FSH-305',
      externalSku: 'CJ-SKU-CROSSBODY-BAG',
      title: 'Mini Urban Crossbody Sling Bag 5L',
      slug: 'mini-urban-crossbody-sling-bag-5l',
      description: 'Compact waterproof crossbody bag with USB charging port, earphone hole, and adjustable strap.',
      costPrice: 8.9,
      sellingPrice: 29.99,
      shippingEstimate: 2.2,
      imageUrl: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&q=80',
      variants: [
        { externalId: 'CJ-VAR-305-A', sku: 'SLG-305-BLK', title: 'Black', costPrice: 8.9, sellingPrice: 29.99, stock: 260 },
        { externalId: 'CJ-VAR-305-B', sku: 'SLG-305-NVY', title: 'Navy Blue', costPrice: 8.9, sellingPrice: 29.99, stock: 190 },
      ],
      rawData: { productNameEn: 'Crossbody Sling Bag', categoryName: 'Bags', weight: '0.25kg', score: 8.8, verdict: 'SELL' },
    },

    // ============================================================
    // --- AUTOMOBILES ---
    // ============================================================
    {
      tenantId: TENANT_IDS.AUTOMOBILES,
      categoryName: 'Car Care & Cleaning',
      externalId: 'CJ-PID-AUTO-101',
      externalSku: 'CJ-SKU-FOAM-CANNON',
      title: 'Foam Cannon Snow Wash Kit with Adjustable Pressure Nozzle',
      slug: 'foam-cannon-snow-wash-kit-adjustable-pressure',
      description: 'Professional grade foam cannon for pressure washers. Creates thick car shampoo foam blanket.',
      costPrice: 12.0,
      sellingPrice: 39.99,
      shippingEstimate: 3.5,
      imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
      variants: [
        { externalId: 'CJ-VAR-AUTO-101-A', sku: 'FOAM-101-STD', title: 'Standard Kit', costPrice: 12.0, sellingPrice: 39.99, stock: 230 },
      ],
      rawData: { productNameEn: 'Foam Cannon Wash Kit', categoryName: 'Car Care', weight: '0.8kg', score: 8.6, verdict: 'SELL' },
    },
    {
      tenantId: TENANT_IDS.AUTOMOBILES,
      categoryName: 'Car Electronics',
      externalId: 'CJ-PID-AUTO-102',
      externalSku: 'CJ-SKU-DASHCAM-4K',
      title: '4K Ultra HD Dash Cam with Night Vision & GPS Tracking',
      slug: '4k-ultra-hd-dash-cam-night-vision-gps',
      description: '170° wide angle front camera, loop recording, G-sensor shock detection, and built-in GPS logger.',
      costPrice: 28.5,
      sellingPrice: 79.99,
      shippingEstimate: 4.0,
      imageUrl: 'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=800&q=80',
      variants: [
        { externalId: 'CJ-VAR-AUTO-102-A', sku: 'DASH-102-4K', title: '4K Front Only', costPrice: 28.5, sellingPrice: 79.99, stock: 160 },
        { externalId: 'CJ-VAR-AUTO-102-B', sku: 'DASH-102-4K-R', title: '4K Front + Rear', costPrice: 35.0, sellingPrice: 99.99, stock: 120 },
      ],
      rawData: { productNameEn: '4K Dash Camera with GPS', categoryName: 'Car Electronics', weight: '0.3kg', score: 9.0, verdict: 'SELL' },
    },

    // ============================================================
    // --- TOYS & KIDS ---
    // ============================================================
    {
      tenantId: TENANT_IDS.TOYS_KIDS,
      categoryName: 'Building & STEM Toys',
      externalId: 'CJ-PID-TOY-101',
      externalSku: 'CJ-SKU-STEM-ROBOT-KIT',
      title: 'DIY STEM Robot Building Kit for Kids 8-14 Years',
      slug: 'diy-stem-robot-building-kit-kids-8-14',
      description: 'Educational coding robot kit with 200+ parts, LED eyes, Bluetooth app control, and solar power option.',
      costPrice: 18.5,
      sellingPrice: 54.99,
      shippingEstimate: 4.5,
      imageUrl: 'https://images.unsplash.com/photo-1531746790731-6c087fecd65a?w=800&q=80',
      variants: [
        { externalId: 'CJ-VAR-TOY-101-A', sku: 'ROBOT-101-STD', title: 'Standard Edition', costPrice: 18.5, sellingPrice: 54.99, stock: 180 },
      ],
      rawData: { productNameEn: 'STEM Robot Kit for Kids', categoryName: 'STEM Toys', weight: '0.6kg', score: 9.2, verdict: 'SELL' },
    },
    {
      tenantId: TENANT_IDS.TOYS_KIDS,
      categoryName: 'Outdoor Play',
      externalId: 'CJ-PID-TOY-102',
      externalSku: 'CJ-SKU-BUBBLE-GUN',
      title: 'Electric Gatling Bubble Machine Gun with LED Lights',
      slug: 'electric-gatling-bubble-machine-gun-led',
      description: 'Auto-bubble gun producing 500+ bubbles per minute with colorful LED disco lights.',
      costPrice: 7.2,
      sellingPrice: 19.99,
      shippingEstimate: 2.0,
      imageUrl: 'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=800&q=80',
      variants: [
        { externalId: 'CJ-VAR-TOY-102-A', sku: 'BUB-102-PNK', title: 'Pink', costPrice: 7.2, sellingPrice: 19.99, stock: 350 },
        { externalId: 'CJ-VAR-TOY-102-B', sku: 'BUB-102-BLU', title: 'Blue', costPrice: 7.2, sellingPrice: 19.99, stock: 280 },
      ],
      rawData: { productNameEn: 'Bubble Machine Gun', categoryName: 'Outdoor Play', weight: '0.35kg', score: 8.8, verdict: 'SELL' },
    },

    // ============================================================
    // --- GROCERIES ---
    // ============================================================
    {
      tenantId: TENANT_IDS.GROCERIES,
      categoryName: 'Coffee & Hot Beverages',
      externalId: 'CJ-PID-GRC-101',
      externalSku: 'CJ-SKU-PREMIUM-COFFEE',
      title: 'Artisan Single Origin Dark Roast Coffee Beans 500g',
      slug: 'artisan-single-origin-dark-roast-coffee-500g',
      description: 'Ethically sourced Arabica beans from Colombian highlands. Rich chocolate and berry flavor profile.',
      costPrice: 9.0,
      sellingPrice: 24.99,
      shippingEstimate: 2.8,
      imageUrl: 'https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=800&q=80',
      variants: [
        { externalId: 'CJ-VAR-GRC-101-A', sku: 'COFFEE-101-500G', title: '500g Whole Bean', costPrice: 9.0, sellingPrice: 24.99, stock: 500 },
        { externalId: 'CJ-VAR-GRC-101-B', sku: 'COFFEE-101-1KG', title: '1kg Whole Bean', costPrice: 16.5, sellingPrice: 44.99, stock: 300 },
      ],
      rawData: { productNameEn: 'Single Origin Dark Roast Coffee', categoryName: 'Coffee', weight: '0.55kg', score: 9.3, verdict: 'SELL' },
    },
    {
      tenantId: TENANT_IDS.GROCERIES,
      categoryName: 'Snacks & Confectionery',
      externalId: 'CJ-PID-GRC-102',
      externalSku: 'CJ-SKU-GOURMET-NUTS',
      title: 'Gourmet Mixed Nuts Roasted & Salted Variety Pack 1kg',
      slug: 'gourmet-mixed-nuts-roasted-salted-variety-pack-1kg',
      description: 'Premium blend of cashews, almonds, macadamia, and Brazil nuts. Zero artificial preservatives.',
      costPrice: 11.0,
      sellingPrice: 29.99,
      shippingEstimate: 3.0,
      imageUrl: 'https://images.unsplash.com/photo-1542838686-937051b7d57c?w=800&q=80',
      variants: [
        { externalId: 'CJ-VAR-GRC-102-A', sku: 'NUTS-102-1KG', title: '1kg Variety Pack', costPrice: 11.0, sellingPrice: 29.99, stock: 400 },
      ],
      rawData: { productNameEn: 'Gourmet Mixed Nuts 1kg', categoryName: 'Snacks', weight: '1.05kg', score: 8.9, verdict: 'SELL' },
    },

    // ============================================================
    // --- PET SUPPLIES ---
    // ============================================================
    {
      tenantId: TENANT_IDS.PET_SUPPLIES,
      categoryName: 'Pet Food',
      externalId: 'CJ-PID-PET-101',
      externalSku: 'CJ-SKU-DOG-FOOD-PREMIUM',
      title: 'Premium Grain-Free Dry Dog Food with Salmon & Sweet Potato 5kg',
      slug: 'premium-grain-free-dry-dog-food-salmon-sweet-potato-5kg',
      description: 'High protein formula with real salmon as #1 ingredient. Omega 3 & 6 for a shiny coat.',
      costPrice: 18.0,
      sellingPrice: 49.99,
      shippingEstimate: 5.5,
      imageUrl: 'https://images.unsplash.com/photo-1589924691995-400dc9edf38f?w=800&q=80',
      variants: [
        { externalId: 'CJ-VAR-PET-101-A', sku: 'DOG-101-5KG', title: '5kg Bag', costPrice: 18.0, sellingPrice: 49.99, stock: 220 },
        { externalId: 'CJ-VAR-PET-101-B', sku: 'DOG-101-10KG', title: '10kg Bag', costPrice: 32.0, sellingPrice: 84.99, stock: 150 },
      ],
      rawData: { productNameEn: 'Grain-Free Salmon Dog Food', categoryName: 'Pet Food', weight: '5.2kg', score: 9.1, verdict: 'SELL' },
    },
    {
      tenantId: TENANT_IDS.PET_SUPPLIES,
      categoryName: 'Pet Accessories',
      externalId: 'CJ-PID-PET-102',
      externalSku: 'CJ-SKU-PET-CARRIER',
      title: 'Airline Approved Soft-Side Pet Carrier Bag for Cats & Dogs',
      slug: 'airline-approved-soft-side-pet-carrier-cats-dogs',
      description: 'Collapsible carrier with mesh windows, fleece mat, shoulder strap, and safety leash hook.',
      costPrice: 16.5,
      sellingPrice: 44.99,
      shippingEstimate: 4.2,
      imageUrl: 'https://images.unsplash.com/photo-1601758125946-6ec2ef64daf8?w=800&q=80',
      variants: [
        { externalId: 'CJ-VAR-PET-102-A', sku: 'CARRIER-102-SM', title: 'Small (up to 5kg)', costPrice: 16.5, sellingPrice: 44.99, stock: 190 },
        { externalId: 'CJ-VAR-PET-102-B', sku: 'CARRIER-102-MD', title: 'Medium (up to 9kg)', costPrice: 20.0, sellingPrice: 54.99, stock: 140 },
      ],
      rawData: { productNameEn: 'Airline Approved Pet Carrier', categoryName: 'Pet Accessories', weight: '0.9kg', score: 8.7, verdict: 'SELL' },
    },

    // ============================================================
    // --- BEAUTY (additional) ---
    // ============================================================
    {
      tenantId: TENANT_IDS.BEAUTY,
      categoryName: 'Hair Care',
      externalId: 'CJ-PID-BTY-101',
      externalSku: 'CJ-SKU-HAIR-DRYER',
      title: 'Professional Ionic Hair Dryer 2200W with Diffuser Attachment',
      slug: 'professional-ionic-hair-dryer-2200w-diffuser',
      description: 'Fast-drying ionic technology reduces frizz and adds shine. Cool shot button and 3 heat settings.',
      costPrice: 19.5,
      sellingPrice: 55.99,
      shippingEstimate: 4.0,
      imageUrl: 'https://images.unsplash.com/photo-1522338242992-e1a54906a8da?w=800&q=80',
      variants: [
        { externalId: 'CJ-VAR-BTY-101-A', sku: 'HDRYR-101-BLK', title: 'Matte Black', costPrice: 19.5, sellingPrice: 55.99, stock: 200 },
        { externalId: 'CJ-VAR-BTY-101-B', sku: 'HDRYR-101-ROSE', title: 'Rose Gold', costPrice: 19.5, sellingPrice: 55.99, stock: 175 },
      ],
      rawData: { productNameEn: 'Ionic Hair Dryer 2200W', categoryName: 'Hair Care', weight: '0.65kg', score: 9.0, verdict: 'SELL' },
    },

    // ============================================================
    // --- SPORTS & OUTDOORS (additional) ---
    // ============================================================
    {
      tenantId: TENANT_IDS.SPORTS_OUTDOORS,
      categoryName: 'Yoga & Pilates',
      externalId: 'CJ-PID-SPT-101',
      externalSku: 'CJ-SKU-YOGA-MAT-PRO',
      title: 'Anti-Slip Professional Yoga Mat 6mm with Alignment Lines',
      slug: 'anti-slip-professional-yoga-mat-6mm-alignment',
      description: 'Eco-friendly TPE foam mat with alignment lines, carry strap, and sweat-resistant surface.',
      costPrice: 9.5,
      sellingPrice: 29.99,
      shippingEstimate: 3.8,
      imageUrl: 'https://images.unsplash.com/photo-1599901860904-17e6ed7083a0?w=800&q=80',
      variants: [
        { externalId: 'CJ-VAR-SPT-101-A', sku: 'YOGA-101-PRP', title: 'Purple 6mm', costPrice: 9.5, sellingPrice: 29.99, stock: 300 },
        { externalId: 'CJ-VAR-SPT-101-B', sku: 'YOGA-101-BLK', title: 'Black 6mm', costPrice: 9.5, sellingPrice: 29.99, stock: 280 },
      ],
      rawData: { productNameEn: 'Professional Yoga Mat 6mm', categoryName: 'Yoga', weight: '1.0kg', score: 8.9, verdict: 'SELL' },
    },
  ];


  let importedCount = 0;

  for (const item of catalogDataset) {
    // A. Resolve or link Category for this tenant
    const categoryId = await resolveCategory(item.tenantId, item.categoryName);

    // B. Seed Store Catalog Product & Variants linked to categoryId
    const product = await prisma.catalogProduct.upsert({
      where: { tenantId_slug: { tenantId: item.tenantId, slug: item.slug } },
      update: {
        title: item.title,
        description: item.description,
        price: item.sellingPrice,
        thumbnailUrl: item.imageUrl,
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
        price: item.sellingPrice,
        thumbnailUrl: item.imageUrl,
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
        title: item.title,
        thumbnailUrl: item.imageUrl,
        retailPrice: item.sellingPrice,
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
        title: item.title,
        thumbnailUrl: item.imageUrl,
        retailPrice: item.sellingPrice,
        costPrice: item.costPrice,
        shippingEstimate: item.shippingEstimate,
        syncStatus: SyncStatus.SUCCESS,
        lastSyncedAt: new Date(),
        rawData: item.rawData,
      },
    });

    // D. Seed ProductVariants & SupplierVariants
    for (const v of item.variants) {
      const productVariant = await prisma.catalogProductVariant.upsert({
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
          title: v.title,
          thumbnailUrl: item.imageUrl,
          retailPrice: v.sellingPrice,
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
          title: v.title,
          thumbnailUrl: item.imageUrl,
          retailPrice: v.sellingPrice,
          costPrice: v.costPrice,
          stock: v.stock,
          syncStatus: SyncStatus.SUCCESS,
          lastSyncedAt: new Date(),
          rawData: { sku: v.sku, title: v.title },
        },
      });
    }

    importedCount++;
    process.stdout.write(
      `  ✓ Product [${product.id}] -> Category [${categoryId}] (${item.categoryName}) for Tenant [${item.tenantId}]: ${product.title}\n`,
    );
  }

  // 3. Auto-fix any unmapped legacy products in database
  const unmappedProducts = await prisma.catalogProduct.findMany({
    where: { categoryId: null },
  });

  if (unmappedProducts.length > 0) {
    for (const unmapped of unmappedProducts) {
      const fallbackCatId = await resolveCategory(unmapped.tenantId, "Men's Sneakers");
      await prisma.catalogProduct.update({
        where: { id: unmapped.id },
        data: { categoryId: fallbackCatId },
      });
      process.stdout.write(
        `  🔧 Auto-assigned Category [${fallbackCatId}] to unmapped Product [${unmapped.id}]: ${unmapped.title}\n`,
      );
    }
  }

  // 4. Seed SupplierSyncLog & SupplierStatistic
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

  await prisma.analyticsSupplier.upsert({
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
      totalRevenue: 1450.0,
    },
  });

  process.stdout.write(
    `🎉 Full Catalog & Category Mapping Completed! Seeded ${importedCount} products cleanly linked to categories in v2-api.\n`,
  );
}

export default seedImportedProducts;
