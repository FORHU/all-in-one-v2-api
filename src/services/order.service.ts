import OrderRepository from '../repositories/order.repository';
import CartRepository from '../repositories/cart.repository';
import CustomerRepository from '../repositories/customer.repository';
import { OrderStatus } from '@prisma/client';
import { throwResponse } from '../utils/throw-response';

/** Who is asking to see an order: a customer, or a platform admin. */
export interface OrderViewer {
  customerId?: string;
  isAdmin: boolean;
}

export default class OrderService {
  static async getOrderDetails(orderId: string, viewer: OrderViewer) {
    const order = await OrderRepository.findById(orderId);
    if (!order) {
      return throwResponse(404, 'Order not found');
    }

    // Orders carry names, addresses and totals. Anyone who isn't the owner gets
    // the same 404 as a non-existent order, so ids can't be probed.
    const isOwner = !!viewer.customerId && order.customerId === viewer.customerId;
    if (!viewer.isAdmin && !isOwner) {
      return throwResponse(404, 'Order not found');
    }

    return order;
  }

  static async getCustomerOrders(customerId: string, page: number = 1, limit: number = 10) {
    return OrderRepository.findByCustomerId(customerId, page, limit);
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

    // Resolve the cart from the caller's own identity. Taking a cartId from the
    // request body would let anyone check out — and then clear — another
    // shopper's cart.
    const cart = customerId
      ? await CartRepository.findByCustomerId(customerId)
      : await CartRepository.findBySessionId(sessionId as string);

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
      totalAmount,
      currency,
      status: OrderStatus.PENDING,
      ...(customerId ? { customer: { connect: { id: customerId } } } : {}),
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

    const order = await OrderRepository.findById(orderId);
    if (!order) {
      return throwResponse(404, 'Order not found');
    }
    return OrderRepository.updateStatus(orderId, status);
  }
}
