import OrderRepository from '../repositories/order.repository';
import CartRepository from '../repositories/cart.repository';
import CustomerRepository from '../repositories/customer.repository';
import { OrderStatus } from '@prisma/client';
import { throwResponse } from '../utils/throw-response';
import { requireTenantId } from '../utils/async-context';

/**
 * Who is asking to see an order: a signed-in customer, a guest holding the
 * session that placed it, or a platform admin.
 */
export interface OrderViewer {
  customerId?: string;
  sessionId?: string;
  isAdmin: boolean;
}

export default class OrderService {
  /**
   * An order belongs to the signed-in customer who placed it, or — for guest
   * checkout, where customerId is null — to whoever holds the session id it
   * was placed with.
   */
  static isOrderOwner(order: { customerId?: string | null; sessionId?: string | null }, viewer: OrderViewer): boolean {
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
    currency?: string;
  }) {
    const { customerId, sessionId, shippingAddressId, currency = 'USD' } = params;

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

    const totalAmount = cart.items.reduce((acc, item) => {
      const price = Number(item.unitPrice);
      return acc + price * item.quantity;
    }, 0);

    const order = await OrderRepository.createOrder({
      tenant: { connect: { id: tenantId } },
      totalAmount,
      currency,
      status: OrderStatus.PENDING,
      // Guests are identified by their session so they can pay for and track
      // the order afterwards.
      ...(customerId ? { customer: { connect: { id: customerId } } } : { sessionId }),
      ...(shippingAddressId ? { shippingAddress: { connect: { id: shippingAddressId } } } : {}),
      items: {
        create: cart.items.map((item) => ({
          productVariantId: item.productVariantId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
      },
    });

    // Clear the cart we actually read from.
    // TODO: order creation and cart clearing should share one transaction, and
    // stock still isn't checked or decremented here.
    await CartRepository.clearCart(cart.id);

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
}
