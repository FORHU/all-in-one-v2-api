import CartRepository from '../repositories/cart.repository';
import { prisma } from '../utils/prisma';
import { throwResponse } from '../utils/throw-response';
import { requireTenantId } from '../utils/async-context';

/**
 * Who is acting on a cart: a signed-in customer, or a guest identified by the
 * `x-session-id` header. Every mutation is checked against this.
 */
export interface CartOwner {
  customerId?: string;
  sessionId?: string;
}

interface CartOwnership {
  tenantId: string;
  customerId: string | null;
  sessionId: string | null;
}

export default class CartService {
  /**
   * Fails unless the cart belongs to the caller. Without this, any cartItemId
   * guessed or leaked lets one shopper edit another's cart.
   */
  private static assertOwns(cart: CartOwnership, owner: CartOwner) {
    // A cart from another vertical is not yours to touch, even if the customer
    // id matches — the same shopper has a separate cart per storefront.
    if (cart.tenantId !== requireTenantId()) {
      return throwResponse(403, 'This cart does not belong to you');
    }

    const byCustomer = !!owner.customerId && cart.customerId === owner.customerId;
    const bySession = !!owner.sessionId && cart.sessionId === owner.sessionId;

    if (!byCustomer && !bySession) {
      return throwResponse(403, 'This cart does not belong to you');
    }
  }

  static async getOrCreateCart(customerId?: string, sessionId?: string) {
    if (!customerId && !sessionId) {
      return throwResponse(400, 'Either customerId or sessionId must be provided');
    }

    const tenantId = requireTenantId();

    let cart;
    if (customerId) {
      cart = await CartRepository.findByCustomerId(tenantId, customerId);
    } else if (sessionId) {
      cart = await CartRepository.findBySessionId(tenantId, sessionId);
    }

    if (!cart) {
      // Never stamp a session id onto a customer's cart: (tenantId, sessionId)
      // is unique, so reusing one that already belongs to a guest cart in this
      // vertical would fail the constraint.
      cart = await CartRepository.createCart(
        tenantId,
        customerId,
        customerId ? undefined : sessionId,
      );
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

    if (!Number.isInteger(quantity) || quantity < 1) {
      return throwResponse(400, 'Quantity must be a positive whole number');
    }

    // Scoped lookup: a variant from another vertical must not be addable here.
    const variant = await prisma.productVariant.findFirst({
      where: { id: productVariantId, tenantId: requireTenantId() },
    });

    if (!variant) {
      return throwResponse(404, 'Product variant not found');
    }

    const cart = await this.getOrCreateCart(customerId, sessionId);
    const unitPrice = variant.sellingPrice || variant.price;

    await CartRepository.addOrUpdateItem(cart.id, productVariantId, quantity, unitPrice);

    return this.getOrCreateCart(customerId, sessionId);
  }

  static async updateCartItemQuantity(cartItemId: string, quantity: number, owner: CartOwner) {
    const item = await CartRepository.findItemById(cartItemId);
    if (!item) return throwResponse(404, 'Cart item not found');

    this.assertOwns(item.cart, owner);

    return CartRepository.updateItemQuantity(cartItemId, quantity);
  }

  static async removeItemFromCart(cartItemId: string, owner: CartOwner) {
    const item = await CartRepository.findItemById(cartItemId);
    if (!item) return throwResponse(404, 'Cart item not found');

    this.assertOwns(item.cart, owner);

    return CartRepository.removeItem(cartItemId);
  }

  static async clearCart(cartId: string, owner: CartOwner) {
    const cart = await CartRepository.findCartById(requireTenantId(), cartId);
    if (!cart) return throwResponse(404, 'Cart not found');

    this.assertOwns(cart, owner);

    return CartRepository.clearCart(cartId);
  }
}
