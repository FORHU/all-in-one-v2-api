import {
  PrismaClient,
  OrderStatus,
  MediaType,
  SupplierOrderStatus,
  ShipmentStatus,
  DiscountType,
} from '@prisma/client';
import { TENANT_IDS } from './tenants.seeder';

export async function seedCommerce(prisma: PrismaClient) {
  process.stdout.write('🌱 Seeding Products, Orders, Wishlists, Reviews & Admin Analytics...\n');

  const tenantId = TENANT_IDS.FASHION;

  // 1. Seed Supplier (Valid UUID)
  const supplierId = '7d890123-4567-4890-a123-456789abcdef';
  const supplier = await prisma.supplierPartner.upsert({
    where: { id: supplierId },
    update: {},
    create: {
      id: supplierId,
      name: 'CJ_DROPSHIPPING',
      displayName: 'CJ Dropshipping Official',
      isActive: true,
    },
  });
  process.stdout.write(`✅ Seeded Supplier: ${supplier.displayName}\n`);

  // 2. Find Customer
  const customer = await prisma.commerceCustomer.findFirst({
    where: { email: 'customer@marketplace.com' },
  });

  if (!customer) {
    process.stderr.write(
      '⚠️ Customer customer@marketplace.com not found. Ensure seedUsers runs first.\n',
    );
    return;
  }

  // 3. Seed Category (Valid UUID)
  const categoryId = 'd8a94b12-3210-4e89-a123-56789abcde01';
  const category = await prisma.catalogCategory.upsert({
    where: { id: categoryId },
    update: {},
    create: {
      id: categoryId,
      tenantId,
      name: "Men's Sneakers",
      slug: 'mens-sneakers',
    },
  });

  // 4. Seed Product & Variant (Valid UUIDs)
  const productId = 'e7b90123-4567-4890-a123-456789abcdef';
  const variantId = 'b1234567-89ab-4cde-f012-3456789abcde';
  const product = await prisma.catalogProduct.upsert({
    where: { id: productId },
    update: {
      categoryId: category.id,
    },
    create: {
      id: productId,
      tenantId,
      title: 'Urban Air Max Runner 2026',
      slug: 'urban-air-max-runner-2026',
      description: 'High performance breathable running sneakers with air cushion sole.',
      price: 99.99,
      thumbnailUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80',
      categoryId: category.id,
      media: {
        create: [
          {
            url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80',
            type: MediaType.IMAGE,
            isPrimary: true,
          },
        ],
      },
      variants: {
        create: [
          {
            id: variantId,
            tenantId,
            sku: 'SNEAKER-RUN-42',
            title: 'Black / Size 42',
            price: 99.99,
            stock: 150,
          },
        ],
      },
    },
  });

  // 5. Seed Shipping Address
  const shippingAddress = await prisma.commerceShippingAddress.create({
    data: {
      customerId: customer.id,
      fullName: 'John Customer',
      addressLine1: '123 Main St',
      city: 'Metropolis',
      state: 'NY',
      postalCode: '10001',
      country: 'US',
    },
  });

  // 6. Seed Order
  const orderId = 'a1234567-89ab-4cde-f012-3456789abcde';
  const supplierOrderId = 'c1234567-89ab-4cde-f012-3456789abcde';
  await prisma.commerceOrder.upsert({
    where: { id: orderId },
    update: {},
    create: {
      id: orderId,
      tenantId,
      customerId: customer.id,
      shippingAddressId: shippingAddress.id,
      totalAmount: 199.98,
      status: OrderStatus.FULFILLED,
      items: {
        create: [
          {
            productVariantId: variantId,
            quantity: 2,
            unitPrice: 99.99,
          },
        ],
      },
      supplierOrders: {
        create: [
          {
            id: supplierOrderId,
            supplierId: supplier.id,
            externalId: 'CJ-EXP-992182',
            status: SupplierOrderStatus.SHIPPED,
            shipments: {
              create: [
                {
                  trackingNumber: 'PH98234812903',
                  carrier: 'DHL Express',
                  status: ShipmentStatus.IN_TRANSIT,
                },
              ],
            },
          },
        ],
      },
    },
  });

  // 7. Seed Wishlist
  await prisma.wishlist.upsert({
    where: { tenantId_customerId: { tenantId, customerId: customer.id } },
    update: {},
    create: {
      tenantId,
      customerId: customer.id,
      items: {
        create: [
          {
            productVariantId: variantId,
          },
        ],
      },
    },
  });

  // 8. Seed Product Review
  await prisma.productReview.create({
    data: {
      tenantId,
      productId: product.id,
      customerId: customer.id,
      rating: 5,
      title: 'Best running sneakers I have ever owned!',
      comment: 'Super lightweight, comfortable cushion, and fast shipping!',
      isVerified: true,
      merchantReply: 'Thank you for your feedback! Enjoy your runs!',
    },
  });

  // 9. Seed Coupon
  await prisma.coupon.upsert({
    where: { tenantId_code: { tenantId, code: 'WELCOME10' } },
    update: {},
    create: {
      tenantId,
      code: 'WELCOME10',
      discountType: DiscountType.FIXED_AMOUNT,
      discountValue: 10.0,
      minOrderValue: 30.0,
      isActive: true,
    },
  });

  // 10. Seed Admin Analytics Statistics
  await prisma.analyticsProductSales.upsert({
    where: { tenantId_productVariantId: { tenantId, productVariantId: variantId } },
    update: { totalSold: 2, totalRevenue: 199.98, totalOrders: 1 },
    create: {
      tenantId,
      productId: product.id,
      productVariantId: variantId,
      totalSold: 2,
      totalRevenue: 199.98,
      totalOrders: 1,
      lastSoldAt: new Date(),
    },
  });

  await prisma.analyticsDailySales.upsert({
    where: { tenantId_date: { tenantId, date: new Date() } },
    update: { ordersCount: 1, revenueAmount: 199.98 },
    create: {
      tenantId,
      date: new Date(),
      ordersCount: 1,
      revenueAmount: 199.98,
    },
  });

  process.stdout.write('🎉 Commerce, Reviews, Wishlists & Admin Analytics seeding completed!\n');
}
