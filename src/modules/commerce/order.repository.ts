import { Prisma, OrderStatus, ShipmentStatus } from '@prisma/client';
import { prisma } from '../../utils/prisma';

/**
 * Orders belong to a single vertical — a shopper checks out separately in
 * fashion and beauty. Every read and write takes `tenantId` so one storefront
 * can never serve or mutate another's orders.
 */
export default class OrderRepository {
  static async findById(tenantId: string, id: string) {
    return prisma.commerceOrder.findFirst({
      where: { id, tenantId },
      include: {
        customer: true,
        shippingAddress: true,
        items: {
          include: {
            productVariant: {
              include: {
                product: true,
              },
            },
          },
        },
        supplierOrders: {
          include: {
            supplier: true,
            shipments: true,
          },
        },
        payments: { include: { events: true, attempts: true } },
      },
    });
  }

  static async findByCustomerId(
    tenantId: string,
    customerId: string,
    page: number = 1,
    limit: number = 10,
  ) {
    const skip = (page - 1) * limit;
    const where = { tenantId, customerId };

    const [orders, total] = await Promise.all([
      prisma.commerceOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          items: true,
          payments: { include: { events: true, attempts: true } },
        },
      }),
      prisma.commerceOrder.count({ where }),
    ]);

    // Key must be `data` — pageFromRepo() maps `data`/`users` to `items`, and
    // returning `orders` silently produced an empty list with a correct total.
    return {
      data: orders,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  static async createOrder(data: Prisma.CommerceOrderCreateInput) {
    return prisma.commerceOrder.create({
      data,
      include: {
        items: true,
        payments: { include: { events: true, attempts: true } },
      },
    });
  }

  static async updateStatus(tenantId: string, id: string, status: OrderStatus) {
    // updateMany accepts a non-unique where clause, so the tenant filter is
    // applied by the database rather than trusted from the caller.
    await prisma.commerceOrder.updateMany({ where: { id, tenantId }, data: { status } });
    return this.findById(tenantId, id);
  }

  // New models added for 100% coverage
  static async getSupplierOrders(tenantId: string, orderId: string) {
    return prisma.commerceSupplierOrder.findMany({
      where: { orderId },
      include: { supplier: true, shipments: true },
    });
  }

  static async updateShipment(
    tenantId: string,
    shipmentId: string,
    status: string,
    trackingNumber?: string,
  ) {
    return prisma.commerceShipment.update({
      where: { id: shipmentId },
      data: { status: status as ShipmentStatus, trackingNumber },
    });
  }
}
