import OrderRepository from './order.repository';
import CartRepository from './cart.repository';
import CustomerRepository from './customer.repository';
import CouponRepository from './coupon.repository';
import InventoryRepository from '../inventory/inventory.repository';
import { OrderStatus, Prisma, Coupon } from '@prisma/client';
import { throwResponse } from '../../utils/throw-response';
import { requireTenantId } from '../../utils/async-context';
import { prisma } from '../../utils/prisma';

/**
 * Who is asking to see an order: a signed-in customer, a guest holding the
 * session that placed it, or a platform admin.
 */
export interface OrderViewer {
  customerId?: string;
  sessionId?: string;
  isAdmin: boolean;
}

interface CartItemLike {
  productVariantId: string;
  quantity: number;
  unitPrice: unknown;
  productVariant?: {
    sku: string | null;
    title: string | null;
    product: {
      title: string;
    };
    media?: { url: string }[];
  };
}

export default class OrderService {
  /**
   * An order belongs to the signed-in customer who placed it, or — for guest
   * checkout, where customerId is null — to whoever holds the session id it
   * was placed with.
   */
  static isOrderOwner(
    order: { customerId?: string | null; sessionId?: string | null },
    viewer: OrderViewer,
  ): boolean {
    if (viewer.customerId && order.customerId === viewer.customerId) return true;
    if (viewer.sessionId && order.sessionId && order.sessionId === viewer.sessionId) return true;
    return false;
  }

  static async getOrderDetails(orderId: string, viewer: OrderViewer) {
    const order = await OrderRepository.findById(requireTenantId(), orderId);
    if (!order) {
      return throwResponse(404, 'Order not found');
    }

    // Orders carry names, addresses and totals. Anyone who isn't the owner gets
    // the same 404 as a non-existent order, so ids can't be probed.
    if (!viewer.isAdmin && !this.isOrderOwner(order, viewer)) {
      return throwResponse(404, 'Order not found');
    }

    return order;
  }

  /** Orders for this customer *in the current vertical* only. */
  static async getCustomerOrders(customerId: string, page: number = 1, limit: number = 10) {
    return OrderRepository.findByCustomerId(requireTenantId(), customerId, page, limit);
  }

  static async checkoutFromCart(params: {
    customerId?: string;
    sessionId?: string;
    shippingAddressId?: string;
    couponCode?: string;
    currency?: string;
  }) {
    const { customerId, sessionId, shippingAddressId, couponCode, currency = 'USD' } = params;

    if (!customerId && !sessionId) {
      return throwResponse(400, 'A signed-in customer or an x-session-id header is required');
    }

    const tenantId = requireTenantId();

    // Resolve the cart from the caller's own identity, within this vertical.
    // Taking a cartId from the request body would let anyone check out — and
    // then clear — another shopper's cart.
    const cart = customerId
      ? await CartRepository.findByCustomerId(tenantId, customerId)
      : await CartRepository.findBySessionId(tenantId, sessionId as string);

    if (!cart || cart.items.length === 0) {
      return throwResponse(400, 'Cart is empty');
    }

    if (shippingAddressId) {
      const address = await CustomerRepository.findAddressById(shippingAddressId);
      if (!address || (customerId && address.customerId !== customerId)) {
        return throwResponse(404, 'Shipping address not found');
      }
    }

    // Decimal, not float: `0.1 + 0.2` is not `0.3`, and a cart of enough cheap
    // line items drifts far enough to disagree with what the gateway charges.
    const subtotal = cart.items.reduce(
      (acc: Prisma.Decimal, item: CartItemLike) =>
        acc.plus(new Prisma.Decimal(item.unitPrice as Prisma.Decimal.Value).times(item.quantity)),
      new Prisma.Decimal(0),
    );

    let coupon: Coupon | null = null;
    if (couponCode) {
      coupon = await CouponRepository.findByCode(tenantId, couponCode);
      if (!coupon || !coupon.isActive) {
        return throwResponse(400, 'Invalid or expired coupon');
      }
    }

    let discountAmount = new Prisma.Decimal(0);
    if (coupon) {
      if (coupon.discountType === 'PERCENTAGE') {
        discountAmount = subtotal
          .times(new Prisma.Decimal(coupon.discountValue as Prisma.Decimal.Value))
          .dividedBy(100);
        if (
          coupon.maxDiscount &&
          discountAmount.greaterThan(new Prisma.Decimal(coupon.maxDiscount as Prisma.Decimal.Value))
        ) {
          discountAmount = new Prisma.Decimal(coupon.maxDiscount as Prisma.Decimal.Value);
        }
      } else if (coupon.discountType === 'FIXED_AMOUNT') {
        discountAmount = new Prisma.Decimal(coupon.discountValue as Prisma.Decimal.Value);
      }
      if (discountAmount.greaterThan(subtotal)) {
        discountAmount = subtotal;
      }
    }

    // Tax and shipping are stored per order but not yet calculated
    const taxAmount = new Prisma.Decimal(0);
    const shippingAmount = new Prisma.Decimal(0);
    const totalAmount = subtotal.minus(discountAmount).plus(taxAmount).plus(shippingAmount);

    // Reserve stock
    for (const item of cart.items) {
      const stockSummary = await InventoryRepository.getStockSummaryByVariant(
        item.productVariantId,
      );
      if (stockSummary.totalAvailable < item.quantity) {
        return throwResponse(
          400,
          `Insufficient stock for ${item.productVariant?.title || item.productVariantId}`,
        );
      }
      const locationWithStock = stockSummary.locations.find(
        (loc: { available: number; locationId: string }) => loc.available >= item.quantity,
      );
      if (!locationWithStock) {
        return throwResponse(
          400,
          `No single location has enough stock for ${item.productVariant?.title || item.productVariantId}`,
        );
      }
      await InventoryRepository.reserveStock(
        item.productVariantId,
        locationWithStock.locationId,
        item.quantity,
      );
    }

    const order = await prisma.$transaction(async (tx) => {
      const createdOrder = await tx.commerceOrder.create({
        data: {
          tenant: { connect: { id: tenantId } },
          subtotal,
          discountAmount,
          taxAmount,
          shippingAmount,
          totalAmount,
          currency,
          status: OrderStatus.PENDING,
          // Guests are identified by their session so they can pay for and track
          // the order afterwards.
          ...(customerId ? { customer: { connect: { id: customerId } } } : { sessionId }),
          ...(shippingAddressId ? { shippingAddress: { connect: { id: shippingAddressId } } } : {}),
          ...(coupon ? { coupon: { connect: { id: coupon.id } } } : {}),
          items: {
            create: cart.items.map((item: CartItemLike) => {
              const variant = item.productVariant;
              const imageUrl = variant?.media?.[0]?.url || null;
              return {
                tenantId: tenantId,
                productVariantId: item.productVariantId,
                quantity: item.quantity,
                unitPrice: new Prisma.Decimal(item.unitPrice as Prisma.Decimal.Value),
                productTitle: variant?.product?.title || 'Unknown Product',
                variantTitle: variant?.title,
                sku: variant?.sku,
                imageUrl: imageUrl,
              };
            }),
          },
        },
        include: {
          items: true,
          payments: { include: { events: true, attempts: true } },
        },
      });

      // Clear the cart we actually read from inside the transaction.
      // Stock has been reserved above (Optimistic locking is available in InventoryRepository).
      await tx.commerceCartItem.deleteMany({
        where: { cartId: cart.id },
      });

      return createdOrder;
    });

    return order;
  }

  static async updateOrderStatus(orderId: string, status: OrderStatus) {
    if (!Object.values(OrderStatus).includes(status)) {
      return throwResponse(400, `Invalid order status '${status}'`);
    }

    const tenantId = requireTenantId();

    const order = await OrderRepository.findById(tenantId, orderId);
    if (!order) {
      return throwResponse(404, 'Order not found');
    }
    return OrderRepository.updateStatus(tenantId, orderId, status);
  }

  static async getSupplierOrders(orderId: string) {
    return OrderRepository.getSupplierOrders(requireTenantId(), orderId);
  }

  static async updateShipment(shipmentId: string, status: string, trackingNumber?: string) {
    return OrderRepository.updateShipment(requireTenantId(), shipmentId, status, trackingNumber);
  }
}
