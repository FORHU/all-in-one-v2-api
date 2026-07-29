import {
  PrismaClient,
  OrderStatus,
  MediaType,
  SupplierOrderStatus,
  ShipmentStatus,
} from '@prisma/client';
import { TENANT_IDS } from './tenants.seeder';

export async function seedCommerce(prisma: PrismaClient) {
  process.stdout.write('🌱 Seeding Products, Orders, & Admin Analytics...\n');

  const tenantId = TENANT_IDS.FASHION;

  // 1. Seed Supplier (Valid UUID)
  const supplierId = '7d890123-4567-4890-a123-456789abcdef';
  const supplier = await prisma.supplier.upsert({
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
  const customer = await prisma.customer.findFirst({
    where: { email: 'customer@marketplace.com' },
  });

  if (!customer) {
    process.stderr.write('⚠️ Customer customer@marketplace.com not found. Ensure seedUsers runs first.\n');
    return;
  }

  // 3. Seed Category (Valid UUID)
  const categoryId = 'd8a94b12-3210-4e89-a123-56789abcde01';
  const category = await prisma.category.upsert({
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
  const product = await prisma.product.upsert({
    where: { id: productId },
    update: {},
    create: {
      id: productId,
      tenantId,
      categoryId: category.id,
      title: 'Urban Air Max Runner 2026',
      slug: 'urban-air-max-runner-2026',
      description: 'Ultra-lightweight mesh breathable running sneakers.',
      featured: true,
      variants: {
        create: [
          {
            id: variantId,
            tenantId,
            sku: 'AM2026-BLK-42',
            title: 'Black / Size 42',
            price: 99.99,
            baseCost: 45.00,
            sellingPrice: 99.99,
            calculatedPrice: 99.99,
            stock: 150,
            attributes: { color: 'Black', size: 42 },
          },
        ],
      },
      media: {
        create: [
          {
            url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff',
            type: MediaType.IMAGE,
            altText: 'Urban Air Max Runner Side View',
            isPrimary: true,
            position: 0,
          },
        ],
      },
    },
  });
  process.stdout.write(`✅ Seeded Product [${product.id}]: ${product.title}\n`);

  // 5. Seed Order with Supplier Order & Shipment (Valid UUIDs)
  const orderId = 'o1122334-4455-4667-8899-aabbccddeeff';
  const supplierOrderId = 's3344556-6677-4889-9900-112233445566';
  await prisma.order.upsert({
    where: { id: orderId },
    update: {},
    create: {
      id: orderId,
      tenantId,
      customerId: customer.id,
      status: OrderStatus.PROCESSING,
      totalAmount: 199.98,
      currency: 'USD',
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

  // 6. Seed Admin Analytics Statistics
  await prisma.productSalesStatistic.upsert({
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

  await prisma.dailySalesStatistic.upsert({
    where: { tenantId_date: { tenantId, date: new Date() } },
    update: { ordersCount: 1, revenueAmount: 199.98 },
    create: {
      tenantId,
      date: new Date(),
      ordersCount: 1,
      revenueAmount: 199.98,
    },
  });

  process.stdout.write('🎉 Commerce and Admin Analytics seeding completed successfully!\n');
}
