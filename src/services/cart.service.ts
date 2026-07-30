import { prisma } from '../utils/prisma';

export interface AddItemInput {
  tenantId?: string;
  customerId?: string;
  sessionId?: string;
  productVariantId: string;
  quantity: number;
}

export interface CartOwner {
  customerId?: string;
  sessionId?: string;
}

export class CartService {
  static async getOrCreateCart(customerId?: string, sessionId?: string, tenantId = 'fashion') {
    if (customerId) {
      let cart = await prisma.commerceCart.findFirst({
        where: { customerId },
        include: { items: { include: { productVariant: true } } },
      });
      if (!cart) {
        cart = await prisma.commerceCart.create({
          data: { tenantId, customerId },
          include: { items: { include: { productVariant: true } } },
        });
      }
      return cart;
    }

    let cart = await prisma.commerceCart.findFirst({
      where: { sessionId: sessionId! },
      include: { items: { include: { productVariant: true } } },
    });
    if (!cart) {
      cart = await prisma.commerceCart.create({
        data: { tenantId, sessionId: sessionId! },
        include: { items: { include: { productVariant: true } } },
      });
    }
    return cart;
  }

  static async getCart(tenantId: string, customerId?: string, sessionId?: string) {
    return this.getOrCreateCart(customerId, sessionId, tenantId);
  }

  static async addItemToCart(input: AddItemInput) {
    const { tenantId = 'fashion', customerId, sessionId, productVariantId, quantity } = input;

    if (quantity <= 0) {
      throw new Error('Quantity must be greater than 0');
    }

    const cart = await this.getOrCreateCart(customerId, sessionId, tenantId);

    const variant = await prisma.catalogProductVariant.findFirst({
      where: { id: productVariantId },
    });

    if (!variant) {
      throw new Error('Product variant not found');
    }

    const existingItem = await prisma.commerceCartItem.findUnique({
      where: {
        cartId_productVariantId: {
          cartId: cart.id,
          productVariantId,
        },
      },
    });

    if (existingItem) {
      await prisma.commerceCartItem.update({
        where: { id: existingItem.id },
        data: {
          quantity: existingItem.quantity + quantity,
          unitPrice: variant.price,
        },
      });
    } else {
      await prisma.commerceCartItem.create({
        data: {
          cartId: cart.id,
          productVariantId,
          quantity,
          unitPrice: variant.price,
        },
      });
    }

    return this.getOrCreateCart(customerId, sessionId, tenantId);
  }

  static async addItem(input: AddItemInput) {
    return this.addItemToCart(input);
  }

  static async updateCartItemQuantity(cartItemId: string, quantity: number, owner: CartOwner) {
    if (quantity <= 0) {
      return prisma.commerceCartItem.delete({
        where: { id: cartItemId },
      });
    }

    return prisma.commerceCartItem.update({
      where: { id: cartItemId },
      data: { quantity },
    });
  }

  static async removeItemFromCart(cartItemId: string, _owner?: CartOwner) {
    return prisma.commerceCartItem.delete({
      where: { id: cartItemId },
    });
  }

  static async removeItem(tenantId: string, itemId: string, customerId?: string, sessionId?: string) {
    return this.removeItemFromCart(itemId, { customerId, sessionId });
  }
}

export default CartService;
