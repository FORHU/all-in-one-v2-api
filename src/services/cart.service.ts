import CartRepository from '../repositories/cart.repository';
import { prisma } from '../utils/prisma';
import { throwResponse } from '../utils/throw-response';

export default class CartService {
  static async getOrCreateCart(customerId?: string, sessionId?: string) {
    if (!customerId && !sessionId) {
      return throwResponse(400, 'Either customerId or sessionId must be provided');
    }

    let cart;
    if (customerId) {
      cart = await CartRepository.findByCustomerId(customerId);
    } else if (sessionId) {
      cart = await CartRepository.findBySessionId(sessionId);
    }

    if (!cart) {
      cart = await CartRepository.createCart(customerId, sessionId);
    }

    return cart;
  }

  static async addItemToCart(params: {
    customerId?: string;
    sessionId?: string;
    productVariantId: string;
    quantity: number;
  }) {
    const { customerId, sessionId, productVariantId, quantity } = params;

    const variant = await prisma.productVariant.findUnique({
      where: { id: productVariantId },
    });

    if (!variant) {
      return throwResponse(404, 'Product variant not found');
    }

    const cart = await this.getOrCreateCart(customerId, sessionId);
    const unitPrice = variant.sellingPrice || variant.price;

    await CartRepository.addOrUpdateItem(cart.id, productVariantId, quantity, unitPrice);

    return this.getOrCreateCart(customerId, sessionId);
  }

  static async updateCartItemQuantity(cartItemId: string, quantity: number) {
    return CartRepository.updateItemQuantity(cartItemId, quantity);
  }

  static async removeItemFromCart(cartItemId: string) {
    return CartRepository.removeItem(cartItemId);
  }

  static async clearCart(cartId: string) {
    return CartRepository.clearCart(cartId);
  }
}
