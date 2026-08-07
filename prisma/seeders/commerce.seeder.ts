import { PrismaClient, OrderStatus, DiscountType } from '@prisma/client';
import { TENANT_IDS } from './tenants.seeder';

const CUSTOMER_EMAILS = [
  'customer@marketplace.com',
  'customer2@marketplace.com',
  'customer3@marketplace.com',
  'customer4@marketplace.com',
  'customer5@marketplace.com',
];

interface OrderItemSeed {
  variantSku: string;
  quantity: number;
}

interface OrderSeed {
  customerEmail: string;
  status: OrderStatus;
  items: OrderItemSeed[];
}

interface ReviewSeed {
  productSlug: string;
  customerEmail: string;
  rating: number;
  title: string;
  comment: string;
  merchantReply?: string;
}

interface CouponSeed {
  code: string;
  discountType: DiscountType;
  discountValue: number;
  minOrderValue?: number;
  maxDiscount?: number;
}

interface WishlistItemSeed {
  customerEmail: string;
  variantSkus: string[];
}

interface TenantCommerceSeed {
  orders: OrderSeed[];
  reviews: ReviewSeed[];
  coupons: CouponSeed[];
  wishlists: WishlistItemSeed[];
}

const COMMERCE_BY_TENANT: Record<string, TenantCommerceSeed> = {
  [TENANT_IDS.FASHION]: {
    orders: [
      { customerEmail: 'customer@marketplace.com', status: OrderStatus.PENDING, items: [{ variantSku: 'HD-001-BLK-XL', quantity: 1 }, { variantSku: 'CAP-007-BLK', quantity: 1 }] },
      { customerEmail: 'customer2@marketplace.com', status: OrderStatus.PROCESSING, items: [{ variantSku: 'SNK-005-BLK-42', quantity: 1 }] },
      { customerEmail: 'customer3@marketplace.com', status: OrderStatus.FULFILLED, items: [{ variantSku: 'TEE-002-WHT-M', quantity: 2 }, { variantSku: 'CGO-003-OLV-32', quantity: 1 }] },
      { customerEmail: 'customer4@marketplace.com', status: OrderStatus.CANCELLED, items: [{ variantSku: 'BMB-004-SLV-L', quantity: 1 }] },
      { customerEmail: 'customer5@marketplace.com', status: OrderStatus.REFUNDED, items: [{ variantSku: 'DRS-006-FLR-M', quantity: 1 }] },
    ],
    reviews: [
      { productSlug: 'urban-air-cushion-running-sneakers', customerEmail: 'customer@marketplace.com', rating: 5, title: 'Best running sneakers I have ever owned!', comment: 'Super lightweight, comfortable cushion, and fast shipping!', merchantReply: 'Thank you for your feedback! Enjoy your runs!' },
      { productSlug: 'heavyweight-oversized-fleece-hoodie', customerEmail: 'customer2@marketplace.com', rating: 4, title: 'Great everyday hoodie', comment: 'Really warm and the oversized fit is perfect for layering.' },
      { productSlug: 'y2k-satin-bomber-jacket', customerEmail: 'customer3@marketplace.com', rating: 5, title: 'Turns heads every time', comment: 'The satin finish looks even better in person. True to size.' },
      { productSlug: 'floral-wrap-midi-dress', customerEmail: 'customer4@marketplace.com', rating: 3, title: 'Nice but runs slightly large', comment: 'Pretty print but I had to size down. Would still recommend.' },
      { productSlug: 'tactical-relaxed-cargo-pants', customerEmail: 'customer5@marketplace.com', rating: 2, title: 'Fabric feels thinner than expected', comment: 'Looks good but the ripstop fabric felt cheaper than the photos suggested.', merchantReply: 'Sorry to hear that — reaching out to make this right!' },
    ],
    coupons: [
      { code: 'WELCOME10', discountType: DiscountType.FIXED_AMOUNT, discountValue: 10, minOrderValue: 30 },
      { code: 'SAVE15FASH', discountType: DiscountType.PERCENTAGE, discountValue: 15, minOrderValue: 50, maxDiscount: 30 },
      { code: 'VIP25FASH', discountType: DiscountType.PERCENTAGE, discountValue: 25, minOrderValue: 100, maxDiscount: 75 },
      { code: 'FREESHIPFASH', discountType: DiscountType.FREE_SHIPPING, discountValue: 0, minOrderValue: 40 },
      { code: 'FLASH5FASH', discountType: DiscountType.FIXED_AMOUNT, discountValue: 5, minOrderValue: 20 },
    ],
    wishlists: [
      { customerEmail: 'customer@marketplace.com', variantSkus: ['SNK-005-WHT-41', 'CAP-007-WHT'] },
      { customerEmail: 'customer2@marketplace.com', variantSkus: ['HD-001-NVY-M'] },
      { customerEmail: 'customer3@marketplace.com', variantSkus: ['BMB-004-BLK-M', 'DRS-006-PNK-M'] },
      { customerEmail: 'customer4@marketplace.com', variantSkus: ['TEE-002-BLK-M'] },
      { customerEmail: 'customer5@marketplace.com', variantSkus: ['CGO-003-BLK-30', 'SNK-005-RED-43'] },
    ],
  },
  [TENANT_IDS.BEAUTY]: {
    orders: [
      { customerEmail: 'customer@marketplace.com', status: OrderStatus.PENDING, items: [{ variantSku: 'SRM-002-30ML', quantity: 1 }, { variantSku: 'MST-003-50ML', quantity: 1 }] },
      { customerEmail: 'customer2@marketplace.com', status: OrderStatus.PROCESSING, items: [{ variantSku: 'LIP-004-TERRA', quantity: 2 }] },
      { customerEmail: 'customer3@marketplace.com', status: OrderStatus.FULFILLED, items: [{ variantSku: 'EDP-006-50ML', quantity: 1 }] },
      { customerEmail: 'customer4@marketplace.com', status: OrderStatus.CANCELLED, items: [{ variantSku: 'HDRYR-005-ROSE', quantity: 1 }] },
      { customerEmail: 'customer5@marketplace.com', status: OrderStatus.REFUNDED, items: [{ variantSku: 'BTR-007-200ML', quantity: 1 }, { variantSku: 'FAC-001-PNK', quantity: 1 }] },
    ],
    reviews: [
      { productSlug: 'vitamin-c-brightening-serum', customerEmail: 'customer@marketplace.com', rating: 5, title: 'Visible glow in 2 weeks', comment: 'My dark spots have noticeably faded. Absorbs quickly with no stickiness.', merchantReply: 'So glad it worked for you! Thank you for sharing.' },
      { productSlug: 'waterproof-sonic-facial-cleansing-brush', customerEmail: 'customer2@marketplace.com', rating: 5, title: 'Deep clean without irritation', comment: 'Gentle enough for daily use, my skin feels so much smoother.' },
      { productSlug: 'citrus-bloom-eau-de-parfum', customerEmail: 'customer3@marketplace.com', rating: 4, title: 'Fresh but doesn’t last all day', comment: 'Smells amazing on application but fades by late afternoon.' },
      { productSlug: 'professional-ionic-hair-dryer', customerEmail: 'customer4@marketplace.com', rating: 3, title: 'Good but loud', comment: 'Dries hair fast, but noise level is higher than my old dryer.' },
      { productSlug: 'matte-liquid-lipstick-trio', customerEmail: 'customer5@marketplace.com', rating: 2, title: 'Dries out my lips', comment: 'Color payoff is great but it feels drying after a few hours.', merchantReply: 'Thanks for the honest review — we recommend pairing with a lip balm underneath!' },
    ],
    coupons: [
      { code: 'WELCOME10BTY', discountType: DiscountType.FIXED_AMOUNT, discountValue: 10, minOrderValue: 25 },
      { code: 'GLOW15BTY', discountType: DiscountType.PERCENTAGE, discountValue: 15, minOrderValue: 40, maxDiscount: 25 },
      { code: 'VIP20BTY', discountType: DiscountType.PERCENTAGE, discountValue: 20, minOrderValue: 80, maxDiscount: 40 },
      { code: 'FREESHIPBTY', discountType: DiscountType.FREE_SHIPPING, discountValue: 0, minOrderValue: 30 },
      { code: 'FLASH5BTY', discountType: DiscountType.FIXED_AMOUNT, discountValue: 5, minOrderValue: 15 },
    ],
    wishlists: [
      { customerEmail: 'customer@marketplace.com', variantSkus: ['EDP-006-100ML', 'BTR-007-400ML'] },
      { customerEmail: 'customer2@marketplace.com', variantSkus: ['MST-003-100ML'] },
      { customerEmail: 'customer3@marketplace.com', variantSkus: ['LIP-004-WINE', 'LIP-004-ROSE'] },
      { customerEmail: 'customer4@marketplace.com', variantSkus: ['FAC-001-SGE'] },
      { customerEmail: 'customer5@marketplace.com', variantSkus: ['HDRYR-005-BLK', 'SRM-002-50ML'] },
    ],
  },
  [TENANT_IDS.ELECTRONICS]: {
    orders: [
      { customerEmail: 'customer@marketplace.com', status: OrderStatus.PENDING, items: [{ variantSku: 'GM-001-BLK', quantity: 1 }, { variantSku: 'KB-003-RED', quantity: 1 }] },
      { customerEmail: 'customer2@marketplace.com', status: OrderStatus.PROCESSING, items: [{ variantSku: 'ANC-002-BLK', quantity: 1 }] },
      { customerEmail: 'customer3@marketplace.com', status: OrderStatus.FULFILLED, items: [{ variantSku: 'WATCH-006-GRP-42', quantity: 1 }] },
      { customerEmail: 'customer4@marketplace.com', status: OrderStatus.CANCELLED, items: [{ variantSku: 'HUB-005-CHR', quantity: 1 }] },
      { customerEmail: 'customer5@marketplace.com', status: OrderStatus.REFUNDED, items: [{ variantSku: 'SPK-007-BLU', quantity: 1 }, { variantSku: 'CAM-004-BLK', quantity: 1 }] },
    ],
    reviews: [
      { productSlug: 'ergonomic-rgb-wireless-gaming-mouse', customerEmail: 'customer@marketplace.com', rating: 5, title: 'Incredible tracking precision', comment: 'Zero latency and the RGB looks amazing on stream.', merchantReply: 'Appreciate the review — happy gaming!' },
      { productSlug: 'active-noise-cancelling-wireless-headphones', customerEmail: 'customer2@marketplace.com', rating: 5, title: 'ANC is on another level', comment: 'Blocks out my entire open office. Battery lasts all week.' },
      { productSlug: 'fitness-smartwatch-amoled-display', customerEmail: 'customer3@marketplace.com', rating: 4, title: 'Great tracking, so-so app', comment: 'Heart rate data is accurate but the companion app could be more polished.' },
      { productSlug: 'compact-75-mechanical-rgb-keyboard', customerEmail: 'customer4@marketplace.com', rating: 3, title: 'Great feel, loud switches', comment: 'Typing feels premium but the brown switches are louder than expected.' },
      { productSlug: 'ultra-hd-4k-streaming-webcam-ring-light', customerEmail: 'customer5@marketplace.com', rating: 2, title: 'Autofocus struggles in low light', comment: 'Image quality is fine in daylight but hunts for focus at night.', merchantReply: 'Thanks for flagging this — a firmware update addressing low-light AF is in testing.' },
    ],
    coupons: [
      { code: 'WELCOME10TECH', discountType: DiscountType.FIXED_AMOUNT, discountValue: 10, minOrderValue: 40 },
      { code: 'SAVE15TECH', discountType: DiscountType.PERCENTAGE, discountValue: 15, minOrderValue: 75, maxDiscount: 50 },
      { code: 'VIP25TECH', discountType: DiscountType.PERCENTAGE, discountValue: 25, minOrderValue: 200, maxDiscount: 100 },
      { code: 'FREESHIP-TECH', discountType: DiscountType.FREE_SHIPPING, discountValue: 0, minOrderValue: 60 },
      { code: 'FLASH5TECH', discountType: DiscountType.FIXED_AMOUNT, discountValue: 5, minOrderValue: 25 },
    ],
    wishlists: [
      { customerEmail: 'customer@marketplace.com', variantSkus: ['WATCH-006-SLV-46', 'ANC-002-SLV'] },
      { customerEmail: 'customer2@marketplace.com', variantSkus: ['KB-003-BRN'] },
      { customerEmail: 'customer3@marketplace.com', variantSkus: ['GM-001-WHT', 'CAM-004-WHT'] },
      { customerEmail: 'customer4@marketplace.com', variantSkus: ['HUB-005-WHT'] },
      { customerEmail: 'customer5@marketplace.com', variantSkus: ['SPK-007-RED', 'WATCH-006-RGD-42'] },
    ],
  },
  [TENANT_IDS.LIVING]: {
    orders: [
      { customerEmail: 'customer@marketplace.com', status: OrderStatus.PENDING, items: [{ variantSku: 'DIF-001-WOD', quantity: 1 }] },
      { customerEmail: 'customer2@marketplace.com', status: OrderStatus.PROCESSING, items: [{ variantSku: 'LMP-002-WHT', quantity: 1 }, { variantSku: 'SHF-007-3T-NAT', quantity: 1 }] },
      { customerEmail: 'customer3@marketplace.com', status: OrderStatus.FULFILLED, items: [{ variantSku: 'CHR-003-CRM', quantity: 1 }] },
      { customerEmail: 'customer4@marketplace.com', status: OrderStatus.CANCELLED, items: [{ variantSku: 'RUG-004-5X7', quantity: 1 }] },
      { customerEmail: 'customer5@marketplace.com', status: OrderStatus.REFUNDED, items: [{ variantSku: 'SHT-006-QN-IVR', quantity: 1 }, { variantSku: 'DIN-005-WHT', quantity: 1 }] },
    ],
    reviews: [
      { productSlug: 'mid-century-boucle-accent-chair', customerEmail: 'customer@marketplace.com', rating: 5, title: 'Statement piece for our living room', comment: 'Incredibly comfortable and the boucle fabric feels premium.', merchantReply: 'Thank you — so glad it fits your space perfectly!' },
      { productSlug: 'egyptian-cotton-bedsheet-set', customerEmail: 'customer2@marketplace.com', rating: 5, title: 'Softest sheets we have owned', comment: 'Hotel-quality feel and the color has held up after many washes.' },
      { productSlug: 'ultrasonic-cool-mist-aromatherapy-diffuser', customerEmail: 'customer3@marketplace.com', rating: 4, title: 'Quiet and stylish', comment: 'Runs silently overnight, though the light ring is a bit bright on the highest setting.' },
      { productSlug: 'handwoven-jute-area-rug', customerEmail: 'customer4@marketplace.com', rating: 3, title: 'Nice texture, sheds a little', comment: 'Looks great but sheds fibers for the first couple of weeks.' },
      { productSlug: 'ceramic-dinnerware-set-12-piece', customerEmail: 'customer5@marketplace.com', rating: 2, title: 'One plate arrived chipped', comment: 'Otherwise beautiful glaze, but packaging needs improvement.', merchantReply: 'So sorry about that — our support team has reached out with a replacement.' },
    ],
    coupons: [
      { code: 'WELCOME10LIV', discountType: DiscountType.FIXED_AMOUNT, discountValue: 10, minOrderValue: 50 },
      { code: 'SAVE15LIV', discountType: DiscountType.PERCENTAGE, discountValue: 15, minOrderValue: 80, maxDiscount: 60 },
      { code: 'VIP25LIV', discountType: DiscountType.PERCENTAGE, discountValue: 25, minOrderValue: 250, maxDiscount: 120 },
      { code: 'FREESHIPLIV', discountType: DiscountType.FREE_SHIPPING, discountValue: 0, minOrderValue: 100 },
      { code: 'FLASH5LIV', discountType: DiscountType.FIXED_AMOUNT, discountValue: 5, minOrderValue: 30 },
    ],
    wishlists: [
      { customerEmail: 'customer@marketplace.com', variantSkus: ['CHR-003-SGE', 'RUG-004-8X10'] },
      { customerEmail: 'customer2@marketplace.com', variantSkus: ['LMP-002-GRY'] },
      { customerEmail: 'customer3@marketplace.com', variantSkus: ['SHT-006-KG-SLT', 'DIN-005-TER'] },
      { customerEmail: 'customer4@marketplace.com', variantSkus: ['SHF-007-4T-WAL'] },
      { customerEmail: 'customer5@marketplace.com', variantSkus: ['DIF-001-WHT', 'SHT-006-QN-SLT'] },
    ],
  },
  [TENANT_IDS.OUTDOOR]: {
    orders: [
      { customerEmail: 'customer@marketplace.com', status: OrderStatus.PENDING, items: [{ variantSku: 'BOT-001-BLK', quantity: 2 }] },
      { customerEmail: 'customer2@marketplace.com', status: OrderStatus.PROCESSING, items: [{ variantSku: 'YOGA-002-PRP', quantity: 1 }] },
      { customerEmail: 'customer3@marketplace.com', status: OrderStatus.FULFILLED, items: [{ variantSku: 'TNT-003-ORG', quantity: 1 }, { variantSku: 'PCK-004-GRP', quantity: 1 }] },
      { customerEmail: 'customer4@marketplace.com', status: OrderStatus.CANCELLED, items: [{ variantSku: 'POL-005-SLVBLU', quantity: 1 }] },
      { customerEmail: 'customer5@marketplace.com', status: OrderStatus.REFUNDED, items: [{ variantSku: 'JER-006-BLU-M', quantity: 1 }, { variantSku: 'SUP-007-TEAL', quantity: 1 }] },
    ],
    reviews: [
      { productSlug: '3-season-backpacking-tent-2-person', customerEmail: 'customer@marketplace.com', rating: 5, title: 'Survived a 3-day storm', comment: 'Setup took under 5 minutes and it kept us completely dry.', merchantReply: 'Glad it held up out there — thanks for the review!' },
      { productSlug: 'double-wall-vacuum-insulated-bottle-32oz', customerEmail: 'customer2@marketplace.com', rating: 5, title: 'Ice cold for two full days', comment: 'No leaks even upside down in my pack. Highly recommend.' },
      { productSlug: 'inflatable-stand-up-paddleboard-10ft', customerEmail: 'customer3@marketplace.com', rating: 4, title: 'Stable and easy to inflate', comment: 'Great for beginners, though the included pump is slow.' },
      { productSlug: 'all-terrain-hiking-backpack-28l', customerEmail: 'customer4@marketplace.com', rating: 3, title: 'Comfortable but tight on space', comment: '28L fills up fast for overnight trips, otherwise great fit.' },
      { productSlug: 'anti-slip-professional-yoga-mat-6mm', customerEmail: 'customer5@marketplace.com', rating: 2, title: 'Slippery when sweaty', comment: 'Alignment lines are great but grip fades once I really start sweating.', merchantReply: 'Thanks for the feedback — we recommend our microfiber towel topper for high-sweat sessions.' },
    ],
    coupons: [
      { code: 'WELCOME10OUT', discountType: DiscountType.FIXED_AMOUNT, discountValue: 10, minOrderValue: 40 },
      { code: 'SAVE15OUT', discountType: DiscountType.PERCENTAGE, discountValue: 15, minOrderValue: 60, maxDiscount: 40 },
      { code: 'VIP25OUT', discountType: DiscountType.PERCENTAGE, discountValue: 25, minOrderValue: 150, maxDiscount: 80 },
      { code: 'FREESHIPOUT2', discountType: DiscountType.FREE_SHIPPING, discountValue: 0, minOrderValue: 60 },
      { code: 'FLASH5OUT', discountType: DiscountType.FIXED_AMOUNT, discountValue: 5, minOrderValue: 25 },
    ],
    wishlists: [
      { customerEmail: 'customer@marketplace.com', variantSkus: ['TNT-003-GRY', 'POL-005-BLKRED'] },
      { customerEmail: 'customer2@marketplace.com', variantSkus: ['PCK-004-MSS'] },
      { customerEmail: 'customer3@marketplace.com', variantSkus: ['SUP-007-CORAL', 'JER-006-BLK-L'] },
      { customerEmail: 'customer4@marketplace.com', variantSkus: ['BOT-001-GRN'] },
      { customerEmail: 'customer5@marketplace.com', variantSkus: ['YOGA-002-BLK', 'JER-006-BLU-L'] },
    ],
  },
};

async function getOrCreateAddress(prisma: PrismaClient, customerId: string, fullName: string) {
  const existing = await prisma.commerceShippingAddress.findFirst({ where: { customerId } });
  if (existing) return existing;

  return prisma.commerceShippingAddress.create({
    data: {
      customerId,
      fullName,
      addressLine1: '123 Main St',
      city: 'Metropolis',
      state: 'NY',
      postalCode: '10001',
      country: 'US',
      isDefault: true,
    },
  });
}

export async function seedCommerce(prisma: PrismaClient) {
  process.stdout.write(
    '🌱 Seeding Orders, Reviews, Wishlists & Coupons across all 5 Tenants...\n',
  );

  // Resolve the 5 shared customers up front
  const customersByEmail = new Map<string, { id: string; email: string; firstName: string | null; lastName: string | null }>();
  for (const email of CUSTOMER_EMAILS) {
    const customer = await prisma.commerceCustomer.findUnique({ where: { email } });
    if (!customer) {
      process.stderr.write(`⚠️ Customer ${email} not found. Ensure seedUsers runs first.\n`);
      continue;
    }
    customersByEmail.set(email, customer);
  }

  for (const [tenantId, tenantData] of Object.entries(COMMERCE_BY_TENANT)) {
    // --- Orders ---
    const existingOrderCount = await prisma.commerceOrder.count({ where: { tenantId } });
    if (existingOrderCount === 0) {
      for (const orderDef of tenantData.orders) {
        const customer = customersByEmail.get(orderDef.customerEmail);
        if (!customer) continue;

        const address = await getOrCreateAddress(
          prisma,
          customer.id,
          `${customer.firstName ?? 'Store'} ${customer.lastName ?? 'Customer'}`,
        );

        const resolvedItems: { productVariantId: string; quantity: number; unitPrice: number; productTitle: string; variantTitle: string; sku: string; imageUrl: string | null }[] = [];

        for (const itemDef of orderDef.items) {
          const variant = await prisma.catalogProductVariant.findUnique({
            where: { tenantId_sku: { tenantId, sku: itemDef.variantSku } },
            include: { product: true },
          });
          if (!variant) {
            process.stderr.write(`⚠️ Variant [${itemDef.variantSku}] not found for tenant [${tenantId}]. Skipping item.\n`);
            continue;
          }
          resolvedItems.push({
            productVariantId: variant.id,
            quantity: itemDef.quantity,
            unitPrice: Number(variant.price),
            productTitle: variant.product.title,
            variantTitle: variant.title,
            sku: variant.sku || '',
            imageUrl: variant.product.thumbnailUrl,
          });
        }

        if (resolvedItems.length === 0) continue;

        const totalAmount = resolvedItems.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

        await prisma.commerceOrder.create({
          data: {
            tenantId,
            customerId: customer.id,
            shippingAddressId: address.id,
            status: orderDef.status,
            totalAmount,
            items: {
              create: resolvedItems.map((i) => ({
                productVariantId: i.productVariantId,
                quantity: i.quantity,
                unitPrice: i.unitPrice,
                productTitle: i.productTitle,
                variantTitle: i.variantTitle,
                sku: i.sku,
                imageUrl: i.imageUrl,
              })),
            },
          },
        });
      }
    }

    // --- Product Reviews ---
    for (const reviewDef of tenantData.reviews) {
      const customer = customersByEmail.get(reviewDef.customerEmail);
      const product = await prisma.catalogProduct.findUnique({
        where: { tenantId_slug: { tenantId, slug: reviewDef.productSlug } },
      });
      if (!customer || !product) continue;

      const existingReview = await prisma.productReview.findFirst({
        where: { tenantId, productId: product.id, customerId: customer.id },
      });
      if (existingReview) continue;

      await prisma.productReview.create({
        data: {
          tenantId,
          productId: product.id,
          customerId: customer.id,
          rating: reviewDef.rating,
          title: reviewDef.title,
          comment: reviewDef.comment,
          isVerified: true,
          merchantReply: reviewDef.merchantReply,
        },
      });
    }

    // --- Wishlists ---
    for (const wishlistDef of tenantData.wishlists) {
      const customer = customersByEmail.get(wishlistDef.customerEmail);
      if (!customer) continue;

      const variantIds: string[] = [];
      for (const sku of wishlistDef.variantSkus) {
        const variant = await prisma.catalogProductVariant.findUnique({
          where: { tenantId_sku: { tenantId, sku } },
        });
        if (variant) variantIds.push(variant.id);
      }
      if (variantIds.length === 0) continue;

      const wishlist = await prisma.wishlist.upsert({
        where: { tenantId_customerId: { tenantId, customerId: customer.id } },
        update: {},
        create: { tenantId, customerId: customer.id },
      });

      for (const variantId of variantIds) {
        await prisma.wishlistItem.upsert({
          where: { wishlistId_productVariantId: { wishlistId: wishlist.id, productVariantId: variantId } },
          update: {},
          create: { wishlistId: wishlist.id, productVariantId: variantId },
        });
      }
    }

    // --- Coupons ---
    for (const couponDef of tenantData.coupons) {
      await prisma.coupon.upsert({
        where: { tenantId_code: { tenantId, code: couponDef.code } },
        update: {},
        create: {
          tenantId,
          code: couponDef.code,
          discountType: couponDef.discountType,
          discountValue: couponDef.discountValue,
          minOrderValue: couponDef.minOrderValue,
          maxDiscount: couponDef.maxDiscount,
          isActive: true,
        },
      });
    }

    // --- Minimal Admin Analytics rollups (kept lightweight, not forced to 5 rows) ---
    const firstProductVariant = await prisma.catalogProductVariant.findFirst({ where: { tenantId } });
    if (firstProductVariant) {
      const tenantOrderCount = await prisma.commerceOrder.count({ where: { tenantId } });
      const tenantRevenue = await prisma.commerceOrder.aggregate({
        where: { tenantId },
        _sum: { totalAmount: true },
      });

      await prisma.analyticsProductSales.upsert({
        where: {
          tenantId_productVariantId: { tenantId, productVariantId: firstProductVariant.id },
        },
        update: { totalSold: 2, totalRevenue: Number(firstProductVariant.price) * 2, totalOrders: 1 },
        create: {
          tenantId,
          productId: firstProductVariant.productId,
          productVariantId: firstProductVariant.id,
          totalSold: 2,
          totalRevenue: Number(firstProductVariant.price) * 2,
          totalOrders: 1,
          lastSoldAt: new Date(),
        },
      });

      await prisma.analyticsDailySales.upsert({
        where: { tenantId_date: { tenantId, date: new Date() } },
        update: {
          ordersCount: tenantOrderCount,
          revenueAmount: tenantRevenue._sum.totalAmount ?? 0,
        },
        create: {
          tenantId,
          date: new Date(),
          ordersCount: tenantOrderCount,
          revenueAmount: tenantRevenue._sum.totalAmount ?? 0,
        },
      });
    }
  }

  process.stdout.write(
    '🎉 Orders, Reviews, Wishlists & Coupons seeding completed for all 5 tenants!\n',
  );
}

export default seedCommerce;
