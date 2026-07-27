import OrderRepository from '../repositories/order.repository';
import CartRepository from '../repositories/cart.repository';
import { OrderStatus } from '@prisma/client';
import { throwResponse } from '../utils/throw-response';

export default class OrderService {
  static async getOrderDetails(orderId: string) {
    const order = await OrderRepository.findById(orderId);
    if (!order) {
      return throwResponse(404, 'Order not found');
    }
    return order;
  }

  static async getCustomerOrders(customerId: string, page: number = 1, limit: number = 10) {
    return OrderRepository.findByCustomerId(customerId, page, limit);
  }

  static async checkoutFromCart(params: {
    cartId: string;
    customerId?: string;
    shippingAddressId?: string;
    currency?: string;
  }) {
    const { cartId, customerId, shippingAddressId, currency = 'USD' } = params;

    const cart = await CartRepository.findByCustomerId(customerId || '');
    if (!cart || cart.items.length === 0) {
      return throwResponse(400, 'Cart is empty');
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

    // Clear cart after checkout
    await CartRepository.clearCart(cartId);

    return order;
  }

  static async updateOrderStatus(orderId: string, status: OrderStatus) {
    const order = await OrderRepository.findById(orderId);
    if (!order) {
      return throwResponse(404, 'Order not found');
    }
    return OrderRepository.updateStatus(orderId, status);
  }
}
