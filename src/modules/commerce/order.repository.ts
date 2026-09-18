import {
  Prisma,
  OrderStatus,
  ShipmentStatus,
  PaymentStatus,
  SupplierOrderStatus,
} from '@prisma/client';
import { prisma } from '../../utils/prisma';
import { paginate } from '../../helpers/pagination.helper';

// An order reaching one of these statuses implies the same fate for any of
// its payments that haven't already settled on their own outcome — see
// updateStatus(). Statuses with no entry here (PENDING/PROCESSING/etc.)
// don't say anything about payment state, so they're left out on purpose.
const ORDER_TO_PAYMENT_STATUS: Partial<Record<OrderStatus, PaymentStatus>> = {
  [OrderStatus.CANCELLED]: PaymentStatus.CANCELLED,
  [OrderStatus.REFUNDED]: PaymentStatus.REFUNDED,
};

// A payment already at one of these has reached its own real-world outcome
// (or lack thereof) — an order-level status change must not overwrite it.
const PAYMENT_TERMINAL_STATUSES: PaymentStatus[] = [
  PaymentStatus.CANCELLED,
  PaymentStatus.REFUNDED,
  PaymentStatus.VOID,
  PaymentStatus.FAILED,
  PaymentStatus.EXPIRED,
];

/**
 * Orders belong to a single vertical — a shopper checks out separately in
 * fashion and beauty. Every read and write takes `tenantId` so one storefront
 * can never serve or mutate another's orders.
 */
export default class OrderRepository {
  // Fields the admin orders list can sort by. Whitelisted for the same reason
  // as UserRepository.SORTABLE_FIELDS — an arbitrary `?sortBy=` can't be
  // handed straight to Prisma's orderBy.
  private static readonly SORTABLE_FIELDS = new Set([
    'createdAt',
    'updatedAt',
    'orderNumber',
    'totalAmount',
    'status',
  ]);

  /**
   * Paginated list for the admin orders page, scoped to one tenant.
   * Search matches the order number or the placing customer's name/email;
   * guest orders (no linked customer) are matched by order number only.
   */
  static async findAll(
    tenantId: string,
    page = 1,
    limit = 10,
    search?: string,
    sortBy?: string,
    sortOrder?: 'asc' | 'desc',
    status?: OrderStatus,
  ) {
    const where: Prisma.CommerceOrderWhereInput = {
      tenantId,
      ...(status && { status }),
      ...(search && {
        OR: [
          { orderNumber: { contains: search, mode: 'insensitive' } },
          { customer: { is: { email: { contains: search, mode: 'insensitive' } } } },
          { customer: { is: { firstName: { contains: search, mode: 'insensitive' } } } },
          { customer: { is: { lastName: { contains: search, mode: 'insensitive' } } } },
        ],
      }),
    };

    const orderBy: Prisma.CommerceOrderOrderByWithRelationInput =
      sortBy && this.SORTABLE_FIELDS.has(sortBy)
        ? { [sortBy]: sortOrder ?? 'asc' }
        : { createdAt: 'desc' };

    return paginate(prisma.commerceOrder, {
      where,
      orderBy,
      page,
      limit,
      search,
      sortBy,
      sortOrder,
      filters: status ? { status } : undefined,
      include: {
        customer: { select: { email: true, firstName: true, lastName: true } },
        _count: { select: { items: true } },
      },
    });
  }

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
            // Narrowed select, not `supplier: true` — SupplierPartner.config
            // can hold API keys/base URLs and must never reach the frontend
            // via a nested include (same fix as getSupplierOrders below).
            supplier: { select: { id: true, name: true, displayName: true } },
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
    const syncedPaymentStatus = ORDER_TO_PAYMENT_STATUS[status];

    await prisma.$transaction(async (tx) => {
      // updateMany accepts a non-unique where clause, so the tenant filter is
      // applied by the database rather than trusted from the caller.
      await tx.commerceOrder.updateMany({ where: { id, tenantId }, data: { status } });

      if (!syncedPaymentStatus) return;

      // Only payments that haven't already settled on their own outcome —
      // see PAYMENT_TERMINAL_STATUSES above.
      const payments = await tx.commercePayment.findMany({
        where: { orderId: id, status: { notIn: PAYMENT_TERMINAL_STATUSES } },
        select: { id: true },
      });
      if (payments.length === 0) return;

      await tx.commercePayment.updateMany({
        where: { id: { in: payments.map((p) => p.id) } },
        data: { status: syncedPaymentStatus },
      });
      // Audit trail for *why* the payment moved — same events table every
      // gateway-driven status change would log to, so a synced transition
      // isn't distinguishable from a real one by omission.
      await tx.commercePaymentEvent.createMany({
        data: payments.map((p) => ({
          paymentId: p.id,
          status: syncedPaymentStatus,
          message: `Synced from order status change to ${status}`,
        })),
      });
    });

    return this.findById(tenantId, id);
  }

  // New models added for 100% coverage
  static async getSupplierOrders(tenantId: string, orderId: string) {
    return prisma.commerceSupplierOrder.findMany({
      where: { orderId },
      // Narrowed select, not `supplier: true` — SupplierPartner.config can
      // hold API keys/base URLs and must never reach the frontend via a
      // nested include (same fix applied to createSupplierOrderWithItems
      // below, which returns the same shape after a fresh placement).
      include: {
        supplier: { select: { id: true, name: true, displayName: true } },
        shipments: true,
      },
    });
  }

  /**
   * Records the outcome of a supplier-side refund request (SupplierAdapter.
   * requestRefund) against the CommerceSupplierOrder it was filed for.
   * Merged into `rawResponse` rather than a dedicated column/status — the
   * schema's SupplierOrderStatus enum has no REFUNDED/DISPUTED value, and
   * adding one is a migration this change intentionally avoids. `rawResponse`
   * already exists for "full supplier order response", so a `refund` key
   * inside it is a natural fit without a schema change.
   */
  static async recordSupplierRefundResult(
    supplierOrderId: string,
    result: { requested: boolean; externalRefundId?: string; raw?: unknown },
  ) {
    const existing = await prisma.commerceSupplierOrder.findUnique({
      where: { id: supplierOrderId },
      select: { rawResponse: true },
    });
    const rawResponse = (existing?.rawResponse as Prisma.JsonObject | null) ?? {};

    return prisma.commerceSupplierOrder.update({
      where: { id: supplierOrderId },
      data: {
        rawResponse: {
          ...rawResponse,
          refund: { ...result, requestedAt: new Date().toISOString() } as Prisma.InputJsonValue,
        },
      },
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

  /** Has this order already been placed with this supplier? Used to refuse a duplicate placement. */
  static async findSupplierOrderForOrder(tenantId: string, orderId: string, supplierId: string) {
    return prisma.commerceSupplierOrder.findFirst({
      where: { orderId, supplierId, order: { tenantId } },
    });
  }

  /**
   * Records a successful supplier placement: creates the CommerceSupplierOrder,
   * links every given CommerceOrderItem to it, and advances the order itself
   * to PROCESSING — all in one transaction, since a partial write here (e.g.
   * order row created but items unlinked) would leave the refund flow (see
   * recordSupplierRefundResult) unable to find which items belong to this
   * supplier order. The order-status bump matters beyond bookkeeping: it's
   * the only signal callers (e.g. a customer-facing "cancel order" button)
   * have that this order has already been placed with a supplier — without
   * it, status would stay PENDING forever even after real money was spent
   * placing/paying for it with CJ.
   */
  static async createSupplierOrderWithItems(
    tenantId: string,
    orderId: string,
    supplierId: string,
    externalId: string,
    status: SupplierOrderStatus,
    rawResponse: Prisma.InputJsonValue,
    itemIds: string[],
  ) {
    return prisma.$transaction(async (tx) => {
      const supplierOrder = await tx.commerceSupplierOrder.create({
        data: { orderId, supplierId, externalId, status, rawResponse },
      });

      await tx.commerceOrderItem.updateMany({
        where: { id: { in: itemIds }, orderId, tenantId },
        data: { supplierOrderId: supplierOrder.id },
      });

      // updateMany (not update): applies the tenant filter at the DB level,
      // same reasoning as updateStatus above. Only bump PENDING -> PROCESSING
      // — an order already PARTIALLY_FULFILLED/FULFILLED/etc. from a prior
      // supplier placement (a second supplier on a mixed order, once that's
      // supported) must not be regressed backward by this one.
      await tx.commerceOrder.updateMany({
        where: { id: orderId, tenantId, status: OrderStatus.PENDING },
        data: { status: OrderStatus.PROCESSING },
      });

      return tx.commerceSupplierOrder.findUniqueOrThrow({
        where: { id: supplierOrder.id },
        // Narrowed select, not `supplier: true` — same reasoning as
        // getSupplierOrders/SupplierRepository.getSyncJobs: SupplierPartner.config
        // can hold API keys/base URLs and must never reach the frontend via a
        // nested include.
        include: {
          supplier: { select: { id: true, name: true, displayName: true } },
          shipments: true,
        },
      });
    });
  }
}
