import { PrismaClient, Prisma, SyncStatus, ProductStatus, MediaType } from '@prisma/client';
import { TENANT_IDS } from './tenants.seeder';
import { SUPPLIER_IDS } from './suppliers.seeder';

interface VariantSeed {
  externalId: string;
  sku: string;
  title: string;
  costPrice: number;
  sellingPrice: number;
  stock: number;
}

interface ProductSeed {
  tenantId: string;
  categorySlug: string;
  externalId: string;
  externalSku: string;
  title: string;
  slug: string;
  description: string;
  tags: string[];
  featured: boolean;
  compareAtPrice?: number;
  shippingEstimate: number;
  imageUrl: string;
  variants: VariantSeed[];
  rawData: Prisma.InputJsonValue;
}

/**
 * Full 5-tenant product catalog (~7 products per tenant, each with 2-3
 * variants). This is the single source of truth for the demo catalog — every
 * other seeder (attributes, size guides, collections, inventory, commerce,
 * reviews, wishlists) queries CatalogProduct/CatalogProductVariant rows that
 * originate here rather than hard-coding their own products.
 */
const CATALOG_DATASET: ProductSeed[] = [
  // ============================================================
  // FASHION — AddictStyle
  // ============================================================
  {
    tenantId: TENANT_IDS.FASHION,
    categorySlug: 'outerwear',
    externalId: 'CJ-PID-FSH-001',
    externalSku: 'CJ-SKU-HOODIE-OVER',
    title: 'Heavyweight Oversized Fleece Hoodie',
    slug: 'heavyweight-oversized-fleece-hoodie',
    description:
      '450GSM cotton-blend French terry fleece hoodie with a drop-shoulder oversized fit and double-layered hood. Built for daily streetwear rotation.',
    tags: ['hoodie', 'streetwear', 'oversized'],
    featured: true,
    compareAtPrice: 58.0,
    shippingEstimate: 4.0,
    imageUrl: 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=800&q=80',
    variants: [
      {
        externalId: 'CJ-VAR-FSH-001-A',
        sku: 'HD-001-GRY-L',
        title: 'Heather Grey / Large',
        costPrice: 15.5,
        sellingPrice: 48.0,
        stock: 250,
      },
      {
        externalId: 'CJ-VAR-FSH-001-B',
        sku: 'HD-001-BLK-XL',
        title: 'Washed Black / XL',
        costPrice: 15.5,
        sellingPrice: 48.0,
        stock: 210,
      },
      {
        externalId: 'CJ-VAR-FSH-001-C',
        sku: 'HD-001-NVY-M',
        title: 'Navy / Medium',
        costPrice: 15.5,
        sellingPrice: 48.0,
        stock: 175,
      },
    ],
    rawData: { productNameEn: 'Oversized Fleece Hoodie', categoryName: 'Outerwear', weight: '0.70kg', score: 8.7, verdict: 'SELL' },
  },
  {
    tenantId: TENANT_IDS.FASHION,
    categorySlug: 'mens-fashion',
    externalId: 'CJ-PID-FSH-002',
    externalSku: 'CJ-SKU-TOP-ESSENTIALS',
    title: 'Essential Oversized Graphic Tee',
    slug: 'essential-oversized-graphic-tee',
    description:
      'Premium 300gsm heavyweight cotton tee with a distressed graphic print and boxy oversized cut. A wardrobe staple for layering or wearing solo.',
    tags: ['tee', 'graphic', 'cotton'],
    featured: true,
    shippingEstimate: 2.5,
    imageUrl: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800&q=80',
    variants: [
      {
        externalId: 'CJ-VAR-FSH-002-A',
        sku: 'TEE-002-WHT-S',
        title: 'White / Small',
        costPrice: 6.8,
        sellingPrice: 22.99,
        stock: 200,
      },
      {
        externalId: 'CJ-VAR-FSH-002-B',
        sku: 'TEE-002-WHT-M',
        title: 'White / Medium',
        costPrice: 6.8,
        sellingPrice: 22.99,
        stock: 350,
      },
      {
        externalId: 'CJ-VAR-FSH-002-C',
        sku: 'TEE-002-BLK-M',
        title: 'Black / Medium',
        costPrice: 6.8,
        sellingPrice: 22.99,
        stock: 280,
      },
    ],
    rawData: { productNameEn: 'Oversized Graphic Tee', categoryName: 'Tops', weight: '0.3kg', score: 8.7, verdict: 'SELL' },
  },
  {
    tenantId: TENANT_IDS.FASHION,
    categorySlug: 'mens-fashion',
    externalId: 'CJ-PID-FSH-003',
    externalSku: 'CJ-SKU-CARGO-PANTS',
    title: 'Tactical Relaxed Cargo Pants',
    slug: 'tactical-relaxed-cargo-pants',
    description:
      'Utilitarian wide-leg cargo trousers in ripstop fabric with an adjustable drawstring hem and reinforced side pockets.',
    tags: ['pants', 'cargo', 'utility'],
    featured: false,
    shippingEstimate: 4.0,
    imageUrl: 'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=800&q=80',
    variants: [
      {
        externalId: 'CJ-VAR-FSH-003-A',
        sku: 'CGO-003-BLK-30',
        title: 'Black / W30',
        costPrice: 14.5,
        sellingPrice: 45.99,
        stock: 180,
      },
      {
        externalId: 'CJ-VAR-FSH-003-B',
        sku: 'CGO-003-OLV-32',
        title: 'Olive Green / W32',
        costPrice: 14.5,
        sellingPrice: 45.99,
        stock: 140,
      },
    ],
    rawData: { productNameEn: 'Cargo Pants', categoryName: 'Bottoms', weight: '0.6kg', score: 8.9, verdict: 'SELL' },
  },
  {
    tenantId: TENANT_IDS.FASHION,
    categorySlug: 'outerwear',
    externalId: 'CJ-PID-FSH-004',
    externalSku: 'CJ-SKU-BOMBER-JACKET',
    title: 'Y2K Satin Bomber Jacket',
    slug: 'y2k-satin-bomber-jacket',
    description:
      'Shiny satin bomber with ribbed cuffs, an embroidered chest logo, and inner quilted lining for a retro Y2K silhouette.',
    tags: ['jacket', 'bomber', 'y2k'],
    featured: true,
    compareAtPrice: 89.0,
    shippingEstimate: 5.5,
    imageUrl: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=800&q=80',
    variants: [
      {
        externalId: 'CJ-VAR-FSH-004-A',
        sku: 'BMB-004-BLK-M',
        title: 'Black / Medium',
        costPrice: 22.0,
        sellingPrice: 69.99,
        stock: 120,
      },
      {
        externalId: 'CJ-VAR-FSH-004-B',
        sku: 'BMB-004-SLV-L',
        title: 'Silver / Large',
        costPrice: 22.0,
        sellingPrice: 69.99,
        stock: 90,
      },
    ],
    rawData: { productNameEn: 'Satin Bomber Jacket', categoryName: 'Outerwear', weight: '0.85kg', score: 9.1, verdict: 'SELL' },
  },
  {
    tenantId: TENANT_IDS.FASHION,
    categorySlug: 'footwear',
    externalId: 'CJ-PID-FSH-005',
    externalSku: 'CJ-SKU-SNEAK-AIR',
    title: 'Urban Air Cushion Running Sneakers',
    slug: 'urban-air-cushion-running-sneakers',
    description:
      'Ultra-lightweight mesh athletic sneakers with a shock-absorbing air cushion heel, built for daily comfort and city miles.',
    tags: ['sneakers', 'running', 'footwear'],
    featured: true,
    shippingEstimate: 4.5,
    imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80',
    variants: [
      {
        externalId: 'CJ-VAR-FSH-005-A',
        sku: 'SNK-005-BLK-42',
        title: 'Black / Size 42',
        costPrice: 18.0,
        sellingPrice: 59.99,
        stock: 150,
      },
      {
        externalId: 'CJ-VAR-FSH-005-B',
        sku: 'SNK-005-RED-43',
        title: 'Crimson Red / Size 43',
        costPrice: 18.0,
        sellingPrice: 59.99,
        stock: 120,
      },
      {
        externalId: 'CJ-VAR-FSH-005-C',
        sku: 'SNK-005-WHT-41',
        title: 'White / Size 41',
        costPrice: 18.0,
        sellingPrice: 59.99,
        stock: 135,
      },
    ],
    rawData: { productNameEn: 'Urban Air Cushion Running Sneakers', categoryName: 'Footwear', weight: '0.65kg', score: 9.0, verdict: 'SELL' },
  },
  {
    tenantId: TENANT_IDS.FASHION,
    categorySlug: 'womens-fashion',
    externalId: 'CJ-PID-FSH-006',
    externalSku: 'CJ-SKU-WRAP-DRESS',
    title: 'Floral Wrap Midi Dress',
    slug: 'floral-wrap-midi-dress',
    description:
      'Flowing viscose midi dress with a flattering wrap silhouette, tie waist, and all-over floral print for warm-weather occasions.',
    tags: ['dress', 'floral', 'midi'],
    featured: false,
    compareAtPrice: 68.0,
    shippingEstimate: 3.5,
    imageUrl: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=800&q=80',
    variants: [
      {
        externalId: 'CJ-VAR-FSH-006-A',
        sku: 'DRS-006-FLR-S',
        title: 'Floral Print / Small',
        costPrice: 17.0,
        sellingPrice: 52.0,
        stock: 130,
      },
      {
        externalId: 'CJ-VAR-FSH-006-B',
        sku: 'DRS-006-FLR-M',
        title: 'Floral Print / Medium',
        costPrice: 17.0,
        sellingPrice: 52.0,
        stock: 145,
      },
      {
        externalId: 'CJ-VAR-FSH-006-C',
        sku: 'DRS-006-PNK-M',
        title: 'Blush Pink / Medium',
        costPrice: 17.0,
        sellingPrice: 52.0,
        stock: 95,
      },
    ],
    rawData: { productNameEn: 'Floral Wrap Midi Dress', categoryName: 'Dresses', weight: '0.35kg', score: 8.6, verdict: 'SELL' },
  },
  {
    tenantId: TENANT_IDS.FASHION,
    categorySlug: 'accessories',
    externalId: 'CJ-PID-FSH-007',
    externalSku: 'CJ-SKU-STREETWEAR-CAP',
    title: '6-Panel Structured Streetwear Snapback Cap',
    slug: 'structured-6-panel-snapback-cap',
    description:
      'Premium 6-panel cap with a flat brim, metal clasp closure, and embroidered logo patch for a clean streetwear finish.',
    tags: ['cap', 'accessories', 'snapback'],
    featured: false,
    shippingEstimate: 1.8,
    imageUrl: 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=800&q=80',
    variants: [
      {
        externalId: 'CJ-VAR-FSH-007-A',
        sku: 'CAP-007-BLK',
        title: 'Black / One Size',
        costPrice: 5.2,
        sellingPrice: 18.99,
        stock: 400,
      },
      {
        externalId: 'CJ-VAR-FSH-007-B',
        sku: 'CAP-007-WHT',
        title: 'White / One Size',
        costPrice: 5.2,
        sellingPrice: 18.99,
        stock: 320,
      },
    ],
    rawData: { productNameEn: 'Snapback Cap', categoryName: 'Accessories', weight: '0.15kg', score: 8.5, verdict: 'SELL' },
  },

  // ============================================================
  // BEAUTY — AskMeBeauty
  // ============================================================
  {
    tenantId: TENANT_IDS.BEAUTY,
    categorySlug: 'tools-devices',
    externalId: 'CJ-PID-BTY-001',
    externalSku: 'CJ-SKU-CLEAN-FACIAL',
    title: 'Waterproof Sonic Facial Cleansing Brush',
    slug: 'waterproof-sonic-facial-cleansing-brush',
    description:
      'Hygienic food-grade silicone facial scrubber with 8 vibration intensities for deep pore cleansing and gentle daily exfoliation.',
    tags: ['skincare-tool', 'cleansing', 'silicone'],
    featured: true,
    shippingEstimate: 2.1,
    imageUrl: 'https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=800&q=80',
    variants: [
      {
        externalId: 'CJ-VAR-BTY-001-A',
        sku: 'FAC-001-PNK',
        title: 'Rose Pink',
        costPrice: 6.2,
        sellingPrice: 24.99,
        stock: 600,
      },
      {
        externalId: 'CJ-VAR-BTY-001-B',
        sku: 'FAC-001-SGE',
        title: 'Sage Green',
        costPrice: 6.2,
        sellingPrice: 24.99,
        stock: 410,
      },
    ],
    rawData: { productNameEn: 'Sonic Facial Cleansing Brush', categoryName: 'Skincare Tools', weight: '0.12kg', score: 8.6, verdict: 'SELL' },
  },
  {
    tenantId: TENANT_IDS.BEAUTY,
    categorySlug: 'skincare',
    externalId: 'CJ-PID-BTY-002',
    externalSku: 'CJ-SKU-VITC-SERUM',
    title: 'Vitamin C Brightening Serum',
    slug: 'vitamin-c-brightening-serum',
    description:
      '20% stabilized vitamin C serum with ferulic acid and vitamin E to visibly brighten dull skin and fade dark spots.',
    tags: ['serum', 'brightening', 'vitamin-c'],
    featured: true,
    compareAtPrice: 42.0,
    shippingEstimate: 1.5,
    imageUrl: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=800&q=80',
    variants: [
      {
        externalId: 'CJ-VAR-BTY-002-A',
        sku: 'SRM-002-30ML',
        title: '30ml Bottle',
        costPrice: 9.0,
        sellingPrice: 34.0,
        stock: 320,
      },
      {
        externalId: 'CJ-VAR-BTY-002-B',
        sku: 'SRM-002-50ML',
        title: '50ml Bottle',
        costPrice: 14.0,
        sellingPrice: 52.0,
        stock: 210,
      },
    ],
    rawData: { productNameEn: 'Vitamin C Brightening Serum', categoryName: 'Skincare', weight: '0.10kg', score: 9.0, verdict: 'SELL' },
  },
  {
    tenantId: TENANT_IDS.BEAUTY,
    categorySlug: 'skincare',
    externalId: 'CJ-PID-BTY-003',
    externalSku: 'CJ-SKU-HYAL-MOIST',
    title: 'Hydrating Hyaluronic Acid Moisturizer',
    slug: 'hydrating-hyaluronic-acid-moisturizer',
    description:
      'Lightweight gel-cream moisturizer with multi-molecular-weight hyaluronic acid for 72-hour hydration without greasiness.',
    tags: ['moisturizer', 'hydration', 'hyaluronic-acid'],
    featured: false,
    shippingEstimate: 1.8,
    imageUrl: 'https://images.unsplash.com/photo-1570194065650-d99fb4bedf0a?w=800&q=80',
    variants: [
      {
        externalId: 'CJ-VAR-BTY-003-A',
        sku: 'MST-003-50ML',
        title: '50ml Jar',
        costPrice: 8.0,
        sellingPrice: 28.5,
        stock: 260,
      },
      {
        externalId: 'CJ-VAR-BTY-003-B',
        sku: 'MST-003-100ML',
        title: '100ml Jar',
        costPrice: 13.5,
        sellingPrice: 45.0,
        stock: 175,
      },
    ],
    rawData: { productNameEn: 'Hyaluronic Acid Moisturizer', categoryName: 'Skincare', weight: '0.18kg', score: 8.8, verdict: 'SELL' },
  },
  {
    tenantId: TENANT_IDS.BEAUTY,
    categorySlug: 'makeup',
    externalId: 'CJ-PID-BTY-004',
    externalSku: 'CJ-SKU-LIP-TRIO',
    title: 'Matte Liquid Lipstick Trio',
    slug: 'matte-liquid-lipstick-trio',
    description:
      'Long-wearing, transfer-proof liquid lipsticks in a soft-matte finish. Lightweight formula that never feels drying.',
    tags: ['lipstick', 'matte', 'makeup'],
    featured: true,
    shippingEstimate: 1.2,
    imageUrl: 'https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=800&q=80',
    variants: [
      {
        externalId: 'CJ-VAR-BTY-004-A',
        sku: 'LIP-004-TERRA',
        title: 'Terracotta',
        costPrice: 4.5,
        sellingPrice: 19.99,
        stock: 500,
      },
      {
        externalId: 'CJ-VAR-BTY-004-B',
        sku: 'LIP-004-ROSE',
        title: 'Rosewood',
        costPrice: 4.5,
        sellingPrice: 19.99,
        stock: 460,
      },
      {
        externalId: 'CJ-VAR-BTY-004-C',
        sku: 'LIP-004-WINE',
        title: 'Berry Wine',
        costPrice: 4.5,
        sellingPrice: 19.99,
        stock: 380,
      },
    ],
    rawData: { productNameEn: 'Matte Liquid Lipstick', categoryName: 'Makeup', weight: '0.05kg', score: 8.4, verdict: 'SELL' },
  },
  {
    tenantId: TENANT_IDS.BEAUTY,
    categorySlug: 'haircare',
    externalId: 'CJ-PID-BTY-005',
    externalSku: 'CJ-SKU-HAIR-DRYER',
    title: 'Professional Ionic Hair Dryer 2200W',
    slug: 'professional-ionic-hair-dryer',
    description:
      'Fast-drying ionic technology that reduces frizz and adds shine, with a cool-shot button, diffuser attachment, and 3 heat settings.',
    tags: ['hair-dryer', 'ionic', 'styling'],
    featured: false,
    compareAtPrice: 74.0,
    shippingEstimate: 4.0,
    imageUrl: 'https://images.unsplash.com/photo-1522338242992-e1a54906a8da?w=800&q=80',
    variants: [
      {
        externalId: 'CJ-VAR-BTY-005-A',
        sku: 'HDRYR-005-BLK',
        title: 'Matte Black',
        costPrice: 19.5,
        sellingPrice: 55.99,
        stock: 200,
      },
      {
        externalId: 'CJ-VAR-BTY-005-B',
        sku: 'HDRYR-005-ROSE',
        title: 'Rose Gold',
        costPrice: 19.5,
        sellingPrice: 55.99,
        stock: 175,
      },
    ],
    rawData: { productNameEn: 'Ionic Hair Dryer 2200W', categoryName: 'Hair Care', weight: '0.65kg', score: 9.0, verdict: 'SELL' },
  },
  {
    tenantId: TENANT_IDS.BEAUTY,
    categorySlug: 'fragrance',
    externalId: 'CJ-PID-BTY-006',
    externalSku: 'CJ-SKU-EDP-CITRUS',
    title: 'Citrus Bloom Eau de Parfum',
    slug: 'citrus-bloom-eau-de-parfum',
    description:
      'A fresh, sparkling fragrance opening with bergamot and mandarin, resting on a warm base of white musk and cedar.',
    tags: ['fragrance', 'eau-de-parfum', 'citrus'],
    featured: true,
    shippingEstimate: 2.4,
    imageUrl: 'https://images.unsplash.com/photo-1541643600914-78b084683601?w=800&q=80',
    variants: [
      {
        externalId: 'CJ-VAR-BTY-006-A',
        sku: 'EDP-006-30ML',
        title: '30ml',
        costPrice: 12.0,
        sellingPrice: 45.0,
        stock: 180,
      },
      {
        externalId: 'CJ-VAR-BTY-006-B',
        sku: 'EDP-006-50ML',
        title: '50ml',
        costPrice: 18.0,
        sellingPrice: 65.0,
        stock: 140,
      },
      {
        externalId: 'CJ-VAR-BTY-006-C',
        sku: 'EDP-006-100ML',
        title: '100ml',
        costPrice: 27.0,
        sellingPrice: 95.0,
        stock: 90,
      },
    ],
    rawData: { productNameEn: 'Citrus Bloom Eau de Parfum', categoryName: 'Fragrance', weight: '0.30kg', score: 8.9, verdict: 'SELL' },
  },
  {
    tenantId: TENANT_IDS.BEAUTY,
    categorySlug: 'bath-body',
    externalId: 'CJ-PID-BTY-007',
    externalSku: 'CJ-SKU-BODY-BUTTER',
    title: 'Jasmine & Shea Whipped Body Butter',
    slug: 'jasmine-shea-body-butter',
    description:
      'Rich whipped body butter blending shea butter and jasmine extract for deeply moisturized, silky-soft skin with a light floral scent.',
    tags: ['body-butter', 'shea', 'moisturizing'],
    featured: false,
    shippingEstimate: 2.0,
    imageUrl: 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=800&q=80',
    variants: [
      {
        externalId: 'CJ-VAR-BTY-007-A',
        sku: 'BTR-007-200ML',
        title: '200ml Jar',
        costPrice: 5.5,
        sellingPrice: 22.0,
        stock: 300,
      },
      {
        externalId: 'CJ-VAR-BTY-007-B',
        sku: 'BTR-007-400ML',
        title: '400ml Jar',
        costPrice: 9.5,
        sellingPrice: 36.0,
        stock: 190,
      },
    ],
    rawData: { productNameEn: 'Jasmine Shea Body Butter', categoryName: 'Bath & Body', weight: '0.25kg', score: 8.5, verdict: 'SELL' },
  },

  // ============================================================
  // ELECTRONICS — DigitFriend
  // ============================================================
  {
    tenantId: TENANT_IDS.ELECTRONICS,
    categorySlug: 'gaming-accessories',
    externalId: 'CJ-PID-ELEC-001',
    externalSku: 'CJ-SKU-GAME-MOUSE',
    title: 'Ergonomic RGB Wireless Gaming Mouse',
    slug: 'ergonomic-rgb-wireless-gaming-mouse',
    description:
      'High precision 16000 DPI rechargeable gaming mouse with 7-mode RGB illumination and lag-free 2.4G wireless technology.',
    tags: ['gaming', 'mouse', 'wireless'],
    featured: true,
    shippingEstimate: 3.5,
    imageUrl: 'https://images.unsplash.com/photo-1616400619175-5beda3a17896?w=800&q=80',
    variants: [
      {
        externalId: 'CJ-VAR-ELEC-001-A',
        sku: 'GM-001-BLK',
        title: 'Matte Black / 16000 DPI',
        costPrice: 8.5,
        sellingPrice: 29.99,
        stock: 450,
      },
      {
        externalId: 'CJ-VAR-ELEC-001-B',
        sku: 'GM-001-WHT',
        title: 'Cyber White / 16000 DPI',
        costPrice: 9.0,
        sellingPrice: 31.99,
        stock: 300,
      },
    ],
    rawData: { productNameEn: 'Ergonomic RGB Wireless Gaming Mouse', categoryName: 'Gaming Accessories', weight: '0.25kg', score: 9.2, verdict: 'SELL' },
  },
  {
    tenantId: TENANT_IDS.ELECTRONICS,
    categorySlug: 'audio',
    externalId: 'CJ-PID-ELEC-002',
    externalSku: 'CJ-SKU-HEAD-ANC',
    title: 'Active Noise Cancelling Wireless Headphones',
    slug: 'active-noise-cancelling-wireless-headphones',
    description:
      'Premium over-ear Bluetooth headphones with 40-hour battery life, active noise cancellation, and high-res audio drivers.',
    tags: ['headphones', 'anc', 'wireless'],
    featured: true,
    compareAtPrice: 99.0,
    shippingEstimate: 5.0,
    imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80',
    variants: [
      {
        externalId: 'CJ-VAR-ELEC-002-A',
        sku: 'ANC-002-BLK',
        title: 'Midnight Black',
        costPrice: 28.0,
        sellingPrice: 79.5,
        stock: 120,
      },
      {
        externalId: 'CJ-VAR-ELEC-002-B',
        sku: 'ANC-002-SLV',
        title: 'Silver Platinum',
        costPrice: 29.5,
        sellingPrice: 84.99,
        stock: 95,
      },
    ],
    rawData: { productNameEn: 'Active Noise Cancelling Wireless Headphones', categoryName: 'Audio', weight: '0.45kg', score: 8.5, verdict: 'SELL' },
  },
  {
    tenantId: TENANT_IDS.ELECTRONICS,
    categorySlug: 'computer-peripherals',
    externalId: 'CJ-PID-ELEC-003',
    externalSku: 'CJ-SKU-KEY-MECH',
    title: 'Compact 75% Mechanical RGB Keyboard',
    slug: 'compact-75-mechanical-rgb-keyboard',
    description:
      'Hot-swappable mechanical keyboard with lubricated switches, PBT keycaps, and tri-mode connectivity (Bluetooth / 2.4G / USB-C).',
    tags: ['keyboard', 'mechanical', 'rgb'],
    featured: false,
    shippingEstimate: 4.2,
    imageUrl: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&q=80',
    variants: [
      {
        externalId: 'CJ-VAR-ELEC-003-A',
        sku: 'KB-003-RED',
        title: 'Red Linear Switch / Grey',
        costPrice: 22.5,
        sellingPrice: 59.99,
        stock: 200,
      },
      {
        externalId: 'CJ-VAR-ELEC-003-B',
        sku: 'KB-003-BRN',
        title: 'Brown Tactile Switch / White',
        costPrice: 23.0,
        sellingPrice: 62.99,
        stock: 180,
      },
    ],
    rawData: { productNameEn: 'Compact 75% Mechanical RGB Keyboard', categoryName: 'Computer Peripherals', weight: '0.75kg', score: 8.9, verdict: 'SELL' },
  },
  {
    tenantId: TENANT_IDS.ELECTRONICS,
    categorySlug: 'cameras-optics',
    externalId: 'CJ-PID-ELEC-004',
    externalSku: 'CJ-SKU-CAM-4K',
    title: 'Ultra HD 4K Streaming Webcam with Ring Light',
    slug: 'ultra-hd-4k-streaming-webcam-ring-light',
    description:
      'Auto-focus 4K webcam with dual noise-reducing microphones and a built-in 3-level adjustable LED ring light for calls and streaming.',
    tags: ['webcam', '4k', 'streaming'],
    featured: false,
    shippingEstimate: 3.0,
    imageUrl: 'https://images.unsplash.com/photo-1596003906949-67221c37965c?w=800&q=80',
    variants: [
      {
        externalId: 'CJ-VAR-ELEC-004-A',
        sku: 'CAM-004-BLK',
        title: 'Matte Black 4K',
        costPrice: 16.0,
        sellingPrice: 49.99,
        stock: 310,
      },
      {
        externalId: 'CJ-VAR-ELEC-004-B',
        sku: 'CAM-004-WHT',
        title: 'Cloud White 4K',
        costPrice: 16.0,
        sellingPrice: 49.99,
        stock: 220,
      },
    ],
    rawData: { productNameEn: 'Ultra HD 4K Streaming Webcam', categoryName: 'Cameras & Optics', weight: '0.30kg', score: 7.8, verdict: 'TEST' },
  },
  {
    tenantId: TENANT_IDS.ELECTRONICS,
    categorySlug: 'smart-home',
    externalId: 'CJ-PID-ELEC-005',
    externalSku: 'CJ-SKU-HUB-VOICE',
    title: 'Smart Home Hub with Voice Control',
    slug: 'smart-home-hub-with-voice-control',
    description:
      'Central smart home hub supporting Zigbee, Wi-Fi and Bluetooth devices, with built-in voice assistant and matter compatibility.',
    tags: ['smart-home', 'hub', 'voice-control'],
    featured: true,
    compareAtPrice: 119.0,
    shippingEstimate: 3.6,
    imageUrl: 'https://images.unsplash.com/photo-1558002038-1055907df827?w=800&q=80',
    variants: [
      {
        externalId: 'CJ-VAR-ELEC-005-A',
        sku: 'HUB-005-CHR',
        title: 'Charcoal',
        costPrice: 32.0,
        sellingPrice: 89.99,
        stock: 140,
      },
      {
        externalId: 'CJ-VAR-ELEC-005-B',
        sku: 'HUB-005-WHT',
        title: 'White',
        costPrice: 32.0,
        sellingPrice: 89.99,
        stock: 160,
      },
    ],
    rawData: { productNameEn: 'Smart Home Hub with Voice Control', categoryName: 'Smart Home', weight: '0.40kg', score: 8.3, verdict: 'SELL' },
  },
  {
    tenantId: TENANT_IDS.ELECTRONICS,
    categorySlug: 'wearable-tech',
    externalId: 'CJ-PID-ELEC-006',
    externalSku: 'CJ-SKU-WATCH-AMOLED',
    title: 'Fitness Smartwatch with AMOLED Display',
    slug: 'fitness-smartwatch-amoled-display',
    description:
      'Always-on AMOLED smartwatch tracking heart rate, SpO2, sleep and 100+ sport modes, with 10-day battery life and full waterproofing.',
    tags: ['smartwatch', 'fitness', 'amoled'],
    featured: true,
    shippingEstimate: 2.8,
    imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80',
    variants: [
      {
        externalId: 'CJ-VAR-ELEC-006-A',
        sku: 'WATCH-006-GRP-42',
        title: 'Graphite / 42mm',
        costPrice: 26.0,
        sellingPrice: 99.0,
        stock: 210,
      },
      {
        externalId: 'CJ-VAR-ELEC-006-B',
        sku: 'WATCH-006-SLV-46',
        title: 'Silver / 46mm',
        costPrice: 27.0,
        sellingPrice: 105.0,
        stock: 165,
      },
      {
        externalId: 'CJ-VAR-ELEC-006-C',
        sku: 'WATCH-006-RGD-42',
        title: 'Rose Gold / 42mm',
        costPrice: 26.5,
        sellingPrice: 102.0,
        stock: 130,
      },
    ],
    rawData: { productNameEn: 'Fitness Smartwatch AMOLED', categoryName: 'Wearable Tech', weight: '0.05kg', score: 9.0, verdict: 'SELL' },
  },
  {
    tenantId: TENANT_IDS.ELECTRONICS,
    categorySlug: 'audio',
    externalId: 'CJ-PID-ELEC-007',
    externalSku: 'CJ-SKU-SPKR-WTRPRF',
    title: 'Portable Waterproof Bluetooth Speaker',
    slug: 'portable-waterproof-bluetooth-speaker',
    description:
      'IP67 waterproof Bluetooth 5.3 speaker with 24-hour playtime, deep bass drivers, and party-light mode.',
    tags: ['speaker', 'bluetooth', 'waterproof'],
    featured: false,
    shippingEstimate: 3.2,
    imageUrl: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=800&q=80',
    variants: [
      {
        externalId: 'CJ-VAR-ELEC-007-A',
        sku: 'SPK-007-BLU',
        title: 'Ocean Blue',
        costPrice: 13.0,
        sellingPrice: 45.0,
        stock: 260,
      },
      {
        externalId: 'CJ-VAR-ELEC-007-B',
        sku: 'SPK-007-RED',
        title: 'Lava Red',
        costPrice: 13.0,
        sellingPrice: 45.0,
        stock: 190,
      },
    ],
    rawData: { productNameEn: 'Portable Waterproof Bluetooth Speaker', categoryName: 'Audio', weight: '0.55kg', score: 8.6, verdict: 'SELL' },
  },

  // ============================================================
  // LIVING — Living
  // ============================================================
  {
    tenantId: TENANT_IDS.LIVING,
    categorySlug: 'home-decor',
    externalId: 'CJ-PID-LIV-001',
    externalSku: 'CJ-SKU-DIFF-HUMID',
    title: 'Ultrasonic Cool Mist Aromatherapy Diffuser 500ml',
    slug: 'ultrasonic-cool-mist-aromatherapy-diffuser',
    description:
      'Whisper-quiet essential oil diffuser with 7 ambient LED light settings and an auto waterless shut-off feature.',
    tags: ['diffuser', 'aromatherapy', 'home-decor'],
    featured: true,
    shippingEstimate: 3.2,
    imageUrl: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&q=80',
    variants: [
      {
        externalId: 'CJ-VAR-LIV-001-A',
        sku: 'DIF-001-WOD',
        title: 'Natural Grain Wood',
        costPrice: 9.8,
        sellingPrice: 32.99,
        stock: 400,
      },
      {
        externalId: 'CJ-VAR-LIV-001-B',
        sku: 'DIF-001-WHT',
        title: 'White Ceramic',
        costPrice: 10.2,
        sellingPrice: 34.99,
        stock: 260,
      },
    ],
    rawData: { productNameEn: 'Ultrasonic Cool Mist Aromatherapy Diffuser', categoryName: 'Home Decor', weight: '0.40kg', score: 8.3, verdict: 'SELL' },
  },
  {
    tenantId: TENANT_IDS.LIVING,
    categorySlug: 'lighting',
    externalId: 'CJ-PID-LIV-002',
    externalSku: 'CJ-SKU-LAMP-DESK',
    title: 'Dimmable LED Desk Lamp with Wireless Charging Pad',
    slug: 'dimmable-led-desk-lamp-wireless-charging',
    description:
      'Modern minimalist desk lamp with 5 color temperatures, touch slider control, and a 10W wireless smartphone charging base.',
    tags: ['lamp', 'lighting', 'desk'],
    featured: false,
    shippingEstimate: 3.1,
    imageUrl: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=800&q=80',
    variants: [
      {
        externalId: 'CJ-VAR-LIV-002-A',
        sku: 'LMP-002-WHT',
        title: 'Nordic White',
        costPrice: 12.4,
        sellingPrice: 39.99,
        stock: 220,
      },
      {
        externalId: 'CJ-VAR-LIV-002-B',
        sku: 'LMP-002-GRY',
        title: 'Charcoal Grey',
        costPrice: 12.4,
        sellingPrice: 39.99,
        stock: 175,
      },
    ],
    rawData: { productNameEn: 'Dimmable LED Desk Lamp', categoryName: 'Lighting', weight: '0.55kg', score: 8.1, verdict: 'SELL' },
  },
  {
    tenantId: TENANT_IDS.LIVING,
    categorySlug: 'furniture',
    externalId: 'CJ-PID-LIV-003',
    externalSku: 'CJ-SKU-CHAIR-BOUCLE',
    title: 'Mid-Century Boucle Accent Chair',
    slug: 'mid-century-boucle-accent-chair',
    description:
      'Curved-back accent chair upholstered in soft boucle fabric with solid oak legs — a statement piece for any living room.',
    tags: ['chair', 'furniture', 'boucle'],
    featured: true,
    compareAtPrice: 319.0,
    shippingEstimate: 24.0,
    imageUrl: 'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=800&q=80',
    variants: [
      {
        externalId: 'CJ-VAR-LIV-003-A',
        sku: 'CHR-003-CRM',
        title: 'Cream Boucle',
        costPrice: 95.0,
        sellingPrice: 249.0,
        stock: 45,
      },
      {
        externalId: 'CJ-VAR-LIV-003-B',
        sku: 'CHR-003-SGE',
        title: 'Sage Green Boucle',
        costPrice: 98.0,
        sellingPrice: 259.0,
        stock: 30,
      },
    ],
    rawData: { productNameEn: 'Mid-Century Boucle Accent Chair', categoryName: 'Furniture', weight: '14.5kg', score: 9.1, verdict: 'SELL' },
  },
  {
    tenantId: TENANT_IDS.LIVING,
    categorySlug: 'home-decor',
    externalId: 'CJ-PID-LIV-004',
    externalSku: 'CJ-SKU-RUG-JUTE',
    title: 'Handwoven Jute Area Rug',
    slug: 'handwoven-jute-area-rug',
    description:
      'Natural fiber handwoven jute rug that adds warm, organic texture to living rooms, entryways or bedrooms.',
    tags: ['rug', 'jute', 'natural-fiber'],
    featured: false,
    shippingEstimate: 8.5,
    imageUrl: 'https://images.unsplash.com/photo-1600166898405-da9535204843?w=800&q=80',
    variants: [
      {
        externalId: 'CJ-VAR-LIV-004-A',
        sku: 'RUG-004-5X7',
        title: '5x7 ft',
        costPrice: 32.0,
        sellingPrice: 89.0,
        stock: 90,
      },
      {
        externalId: 'CJ-VAR-LIV-004-B',
        sku: 'RUG-004-8X10',
        title: '8x10 ft',
        costPrice: 52.0,
        sellingPrice: 139.0,
        stock: 55,
      },
    ],
    rawData: { productNameEn: 'Handwoven Jute Area Rug', categoryName: 'Home Decor', weight: '6.2kg', score: 8.7, verdict: 'SELL' },
  },
  {
    tenantId: TENANT_IDS.LIVING,
    categorySlug: 'kitchen-dining',
    externalId: 'CJ-PID-LIV-005',
    externalSku: 'CJ-SKU-DINNERWARE-12',
    title: 'Ceramic Dinnerware Set, 12-Piece',
    slug: 'ceramic-dinnerware-set-12-piece',
    description:
      'Matte-glazed stoneware dinnerware set for four — includes dinner plates, salad plates and bowls in a reactive glaze finish.',
    tags: ['dinnerware', 'ceramic', 'kitchen'],
    featured: true,
    shippingEstimate: 9.0,
    imageUrl: 'https://images.unsplash.com/photo-1584346133934-a3afd2035dd7?w=800&q=80',
    variants: [
      {
        externalId: 'CJ-VAR-LIV-005-A',
        sku: 'DIN-005-WHT',
        title: 'Matte White',
        costPrice: 24.0,
        sellingPrice: 74.0,
        stock: 110,
      },
      {
        externalId: 'CJ-VAR-LIV-005-B',
        sku: 'DIN-005-TER',
        title: 'Terracotta',
        costPrice: 24.0,
        sellingPrice: 74.0,
        stock: 85,
      },
    ],
    rawData: { productNameEn: 'Ceramic Dinnerware Set 12pc', categoryName: 'Kitchen & Dining', weight: '5.8kg', score: 8.8, verdict: 'SELL' },
  },
  {
    tenantId: TENANT_IDS.LIVING,
    categorySlug: 'bedding-bath',
    externalId: 'CJ-PID-LIV-006',
    externalSku: 'CJ-SKU-SHEETS-EGYPT',
    title: 'Egyptian Cotton Bedsheet Set',
    slug: 'egyptian-cotton-bedsheet-set',
    description:
      '400-thread-count long-staple Egyptian cotton sheet set with fitted sheet, flat sheet, and two pillowcases.',
    tags: ['bedding', 'cotton', 'bedsheets'],
    featured: false,
    compareAtPrice: 89.0,
    shippingEstimate: 3.0,
    imageUrl: 'https://images.unsplash.com/photo-1522771930-78848d9293e8?w=800&q=80',
    variants: [
      {
        externalId: 'CJ-VAR-LIV-006-A',
        sku: 'SHT-006-QN-IVR',
        title: 'Queen / Ivory',
        costPrice: 22.0,
        sellingPrice: 68.0,
        stock: 150,
      },
      {
        externalId: 'CJ-VAR-LIV-006-B',
        sku: 'SHT-006-KG-SLT',
        title: 'King / Slate Grey',
        costPrice: 26.0,
        sellingPrice: 78.0,
        stock: 120,
      },
      {
        externalId: 'CJ-VAR-LIV-006-C',
        sku: 'SHT-006-QN-SLT',
        title: 'Queen / Slate Grey',
        costPrice: 22.0,
        sellingPrice: 68.0,
        stock: 135,
      },
    ],
    rawData: { productNameEn: 'Egyptian Cotton Bedsheet Set', categoryName: 'Bedding & Bath', weight: '1.8kg', score: 9.0, verdict: 'SELL' },
  },
  {
    tenantId: TENANT_IDS.LIVING,
    categorySlug: 'storage-organization',
    externalId: 'CJ-PID-LIV-007',
    externalSku: 'CJ-SKU-SHELF-BAMBOO',
    title: 'Modular Bamboo Storage Shelf',
    slug: 'modular-bamboo-storage-shelf',
    description:
      'Sustainably sourced bamboo shelving unit with adjustable tiers — ideal for living rooms, offices or entryways.',
    tags: ['shelf', 'storage', 'bamboo'],
    featured: false,
    shippingEstimate: 11.0,
    imageUrl: 'https://images.unsplash.com/photo-1594620302200-9a762244a156?w=800&q=80',
    variants: [
      {
        externalId: 'CJ-VAR-LIV-007-A',
        sku: 'SHF-007-3T-NAT',
        title: '3-Tier Natural',
        costPrice: 19.0,
        sellingPrice: 55.0,
        stock: 130,
      },
      {
        externalId: 'CJ-VAR-LIV-007-B',
        sku: 'SHF-007-4T-WAL',
        title: '4-Tier Walnut',
        costPrice: 24.0,
        sellingPrice: 69.0,
        stock: 95,
      },
    ],
    rawData: { productNameEn: 'Modular Bamboo Storage Shelf', categoryName: 'Storage & Organization', weight: '7.5kg', score: 8.5, verdict: 'SELL' },
  },

  // ============================================================
  // OUTDOOR — Outdoor
  // ============================================================
  {
    tenantId: TENANT_IDS.OUTDOOR,
    categorySlug: 'hydration-gear',
    externalId: 'CJ-PID-OUT-001',
    externalSku: 'CJ-SKU-BOT-VACUUM',
    title: 'Double-Wall Vacuum Insulated Steel Bottle 32oz',
    slug: 'double-wall-vacuum-insulated-bottle-32oz',
    description:
      'Leakproof sports water bottle that keeps drinks ice cold for 24 hours or piping hot for 12 hours. Built for the trail.',
    tags: ['bottle', 'hydration', 'insulated'],
    featured: true,
    shippingEstimate: 2.9,
    imageUrl: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=800&q=80',
    variants: [
      {
        externalId: 'CJ-VAR-OUT-001-A',
        sku: 'BOT-001-BLK',
        title: 'Matte Black 32oz',
        costPrice: 7.5,
        sellingPrice: 27.99,
        stock: 380,
      },
      {
        externalId: 'CJ-VAR-OUT-001-B',
        sku: 'BOT-001-GRN',
        title: 'Forest Green 32oz',
        costPrice: 7.5,
        sellingPrice: 27.99,
        stock: 290,
      },
    ],
    rawData: { productNameEn: 'Vacuum Insulated Stainless Steel Bottle', categoryName: 'Hydration & Gear', weight: '0.35kg', score: 8.4, verdict: 'SELL' },
  },
  {
    tenantId: TENANT_IDS.OUTDOOR,
    categorySlug: 'yoga-fitness',
    externalId: 'CJ-PID-OUT-002',
    externalSku: 'CJ-SKU-YOGA-MAT-PRO',
    title: 'Anti-Slip Professional Yoga Mat 6mm',
    slug: 'anti-slip-professional-yoga-mat-6mm',
    description:
      'Eco-friendly TPE foam mat with alignment lines, a carry strap, and a sweat-resistant surface for indoor or outdoor practice.',
    tags: ['yoga', 'mat', 'fitness'],
    featured: false,
    shippingEstimate: 3.8,
    imageUrl: 'https://images.unsplash.com/photo-1599901860904-17e6ed7083a0?w=800&q=80',
    variants: [
      {
        externalId: 'CJ-VAR-OUT-002-A',
        sku: 'YOGA-002-PRP',
        title: 'Purple 6mm',
        costPrice: 9.5,
        sellingPrice: 29.99,
        stock: 300,
      },
      {
        externalId: 'CJ-VAR-OUT-002-B',
        sku: 'YOGA-002-BLK',
        title: 'Black 6mm',
        costPrice: 9.5,
        sellingPrice: 29.99,
        stock: 280,
      },
    ],
    rawData: { productNameEn: 'Professional Yoga Mat 6mm', categoryName: 'Yoga & Fitness', weight: '1.0kg', score: 8.9, verdict: 'SELL' },
  },
  {
    tenantId: TENANT_IDS.OUTDOOR,
    categorySlug: 'camping-hiking',
    externalId: 'CJ-PID-OUT-003',
    externalSku: 'CJ-SKU-TENT-2P',
    title: '3-Season Backpacking Tent, 2-Person',
    slug: '3-season-backpacking-tent-2-person',
    description:
      'Ultralight freestanding 2-person tent with a full-coverage rainfly, dual vestibules, and a 4-minute setup.',
    tags: ['tent', 'camping', 'backpacking'],
    featured: true,
    compareAtPrice: 189.0,
    shippingEstimate: 6.0,
    imageUrl: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800&q=80',
    variants: [
      {
        externalId: 'CJ-VAR-OUT-003-A',
        sku: 'TNT-003-ORG',
        title: 'Sunrise Orange',
        costPrice: 58.0,
        sellingPrice: 159.0,
        stock: 60,
      },
      {
        externalId: 'CJ-VAR-OUT-003-B',
        sku: 'TNT-003-GRY',
        title: 'Slate Grey',
        costPrice: 58.0,
        sellingPrice: 159.0,
        stock: 48,
      },
    ],
    rawData: { productNameEn: '3-Season Backpacking Tent 2-Person', categoryName: 'Camping & Hiking', weight: '2.1kg', score: 9.2, verdict: 'SELL' },
  },
  {
    tenantId: TENANT_IDS.OUTDOOR,
    categorySlug: 'camping-hiking',
    externalId: 'CJ-PID-OUT-004',
    externalSku: 'CJ-SKU-PACK-28L',
    title: 'All-Terrain Hydration Hiking Backpack 28L',
    slug: 'all-terrain-hiking-backpack-28l',
    description:
      'Ventilated trail backpack with a 2L hydration bladder compartment, rain cover, and adjustable torso fit.',
    tags: ['backpack', 'hiking', 'hydration'],
    featured: true,
    shippingEstimate: 5.0,
    imageUrl: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&q=80',
    variants: [
      {
        externalId: 'CJ-VAR-OUT-004-A',
        sku: 'PCK-004-GRP',
        title: '28L Graphite',
        costPrice: 26.0,
        sellingPrice: 89.0,
        stock: 100,
      },
      {
        externalId: 'CJ-VAR-OUT-004-B',
        sku: 'PCK-004-MSS',
        title: '28L Moss Green',
        costPrice: 26.0,
        sellingPrice: 89.0,
        stock: 85,
      },
    ],
    rawData: { productNameEn: 'All-Terrain Hiking Backpack 28L', categoryName: 'Camping & Hiking', weight: '1.1kg', score: 8.9, verdict: 'SELL' },
  },
  {
    tenantId: TENANT_IDS.OUTDOOR,
    categorySlug: 'camping-hiking',
    externalId: 'CJ-PID-OUT-005',
    externalSku: 'CJ-SKU-POLES-CARBON',
    title: 'Carbon Fiber Trekking Poles (Pair)',
    slug: 'carbon-fiber-trekking-poles-pair',
    description:
      'Ultralight collapsible carbon fiber trekking poles with cork grips, quick-lock adjustment, and tungsten tips.',
    tags: ['trekking-poles', 'hiking', 'carbon-fiber'],
    featured: false,
    shippingEstimate: 2.6,
    imageUrl: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&q=80',
    variants: [
      {
        externalId: 'CJ-VAR-OUT-005-A',
        sku: 'POL-005-BLKRED',
        title: 'Pair / Black-Red',
        costPrice: 17.0,
        sellingPrice: 64.0,
        stock: 140,
      },
      {
        externalId: 'CJ-VAR-OUT-005-B',
        sku: 'POL-005-SLVBLU',
        title: 'Pair / Silver-Blue',
        costPrice: 17.0,
        sellingPrice: 64.0,
        stock: 110,
      },
    ],
    rawData: { productNameEn: 'Carbon Fiber Trekking Poles', categoryName: 'Camping & Hiking', weight: '0.46kg', score: 8.7, verdict: 'SELL' },
  },
  {
    tenantId: TENANT_IDS.OUTDOOR,
    categorySlug: 'cycling',
    externalId: 'CJ-PID-OUT-006',
    externalSku: 'CJ-SKU-JERSEY-CYCLE',
    title: 'Quick-Dry Performance Cycling Jersey',
    slug: 'quick-dry-performance-cycling-jersey',
    description:
      'Aerodynamic full-zip cycling jersey with moisture-wicking fabric, reflective trim, and three rear cargo pockets.',
    tags: ['cycling', 'jersey', 'apparel'],
    featured: false,
    shippingEstimate: 2.2,
    imageUrl: 'https://images.unsplash.com/photo-1541625602330-2277a4c46182?w=800&q=80',
    variants: [
      {
        externalId: 'CJ-VAR-OUT-006-A',
        sku: 'JER-006-BLU-M',
        title: 'Electric Blue / Medium',
        costPrice: 12.5,
        sellingPrice: 42.0,
        stock: 160,
      },
      {
        externalId: 'CJ-VAR-OUT-006-B',
        sku: 'JER-006-BLU-L',
        title: 'Electric Blue / Large',
        costPrice: 12.5,
        sellingPrice: 42.0,
        stock: 145,
      },
      {
        externalId: 'CJ-VAR-OUT-006-C',
        sku: 'JER-006-BLK-L',
        title: 'Black / Large',
        costPrice: 12.5,
        sellingPrice: 42.0,
        stock: 120,
      },
    ],
    rawData: { productNameEn: 'Performance Cycling Jersey', categoryName: 'Cycling', weight: '0.20kg', score: 8.6, verdict: 'SELL' },
  },
  {
    tenantId: TENANT_IDS.OUTDOOR,
    categorySlug: 'water-sports',
    externalId: 'CJ-PID-OUT-007',
    externalSku: 'CJ-SKU-SUP-10FT',
    title: 'Inflatable Stand-Up Paddleboard 10ft',
    slug: 'inflatable-stand-up-paddleboard-10ft',
    description:
      'Military-grade drop-stitch inflatable SUP with a full accessory kit — paddle, pump, leash and backpack included.',
    tags: ['paddleboard', 'sup', 'water-sports'],
    featured: true,
    compareAtPrice: 429.0,
    shippingEstimate: 14.0,
    imageUrl: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&q=80',
    variants: [
      {
        externalId: 'CJ-VAR-OUT-007-A',
        sku: 'SUP-007-TEAL',
        title: '10ft Aqua Teal',
        costPrice: 145.0,
        sellingPrice: 349.0,
        stock: 35,
      },
      {
        externalId: 'CJ-VAR-OUT-007-B',
        sku: 'SUP-007-CORAL',
        title: '10ft Coral',
        costPrice: 145.0,
        sellingPrice: 349.0,
        stock: 28,
      },
    ],
    rawData: { productNameEn: 'Inflatable Stand-Up Paddleboard 10ft', categoryName: 'Water Sports', weight: '9.8kg', score: 9.0, verdict: 'SELL' },
  },
];

export async function seedImportedProducts(prisma: PrismaClient) {
  process.stdout.write('📦 Seeding Full 5-Tenant Product Catalog...\n');

  let importedCount = 0;
  const perTenantCount: Record<string, number> = {};

  for (const item of CATALOG_DATASET) {
    // A. Resolve category created by categories.seeder (must run before this seeder)
    const category = await prisma.catalogCategory.findUnique({
      where: { tenantId_slug: { tenantId: item.tenantId, slug: item.categorySlug } },
    });

    if (!category) {
      process.stderr.write(
        `⚠️ Category [${item.categorySlug}] not found for tenant [${item.tenantId}]. Ensure seedCategories runs first.\n`,
      );
      continue;
    }

    // B. Seed Catalog Product & primary media, linked to the resolved category
    const basePrice = Math.min(...item.variants.map((v) => v.sellingPrice));
    const product = await prisma.catalogProduct.upsert({
      where: { tenantId_slug: { tenantId: item.tenantId, slug: item.slug } },
      update: {
        title: item.title,
        description: item.description,
        tags: item.tags,
        price: basePrice,
        compareAtPrice: item.compareAtPrice ?? null,
        thumbnailUrl: item.imageUrl,
        categoryId: category.id,
        status: ProductStatus.PUBLISHED,
        featured: item.featured,
      },
      create: {
        tenantId: item.tenantId,
        categoryId: category.id,
        title: item.title,
        slug: item.slug,
        description: item.description,
        tags: item.tags,
        price: basePrice,
        compareAtPrice: item.compareAtPrice ?? null,
        thumbnailUrl: item.imageUrl,
        status: ProductStatus.PUBLISHED,
        featured: item.featured,
        publishedAt: new Date(),
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

    // C. Seed Raw SupplierProduct record linked to canonical CJ Dropshipping supplier
    const supplierProduct = await prisma.supplierProduct.upsert({
      where: {
        supplierId_externalId: {
          supplierId: SUPPLIER_IDS.CJ_DROPSHIPPING,
          externalId: item.externalId,
        },
      },
      update: {
        productId: product.id,
        title: item.title,
        thumbnailUrl: item.imageUrl,
        retailPrice: basePrice,
        costPrice: item.variants[0].costPrice,
        shippingEstimate: item.shippingEstimate,
        syncStatus: SyncStatus.SUCCESS,
        lastSyncedAt: new Date(),
        rawData: item.rawData,
      },
      create: {
        supplierId: SUPPLIER_IDS.CJ_DROPSHIPPING,
        productId: product.id,
        externalId: item.externalId,
        externalSku: item.externalSku,
        title: item.title,
        thumbnailUrl: item.imageUrl,
        retailPrice: basePrice,
        costPrice: item.variants[0].costPrice,
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
          attributes: { title: v.title },
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
          attributes: { title: v.title },
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
    perTenantCount[item.tenantId] = (perTenantCount[item.tenantId] || 0) + 1;
    process.stdout.write(
      `  ✓ Product [${product.id}] -> Category [${item.categorySlug}] for Tenant [${item.tenantId}]: ${product.title}\n`,
    );
  }

  // Seed a sync log + per-tenant supplier statistics for the CJ Dropshipping import run
  await prisma.supplierSyncLog.create({
    data: {
      supplierId: SUPPLIER_IDS.CJ_DROPSHIPPING,
      action: 'SYNC_PRODUCTS',
      status: SyncStatus.SUCCESS,
      recordsProcessed: importedCount,
      details: { importedCount, provider: 'cj-dropshipping' },
      completedAt: new Date(),
    },
  });

  for (const [tenantId, count] of Object.entries(perTenantCount)) {
    await prisma.analyticsSupplier.upsert({
      where: { tenantId_supplierId: { tenantId, supplierId: SUPPLIER_IDS.CJ_DROPSHIPPING } },
      update: { productsImported: count, updatedAt: new Date() },
      create: {
        tenantId,
        supplierId: SUPPLIER_IDS.CJ_DROPSHIPPING,
        productsImported: count,
        totalOrders: 12,
        totalRevenue: 1450.0,
      },
    });
  }

  process.stdout.write(
    `🎉 Full Catalog Import Complete! Seeded ${importedCount} products across 5 tenants in v2-api.\n`,
  );
}

export default seedImportedProducts;
