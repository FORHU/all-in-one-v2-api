import { prisma } from '../../utils/prisma';
import InventoryRepository from '../inventory/inventory.repository';
import { requireTenantId } from '../../utils/async-context';

export interface AddItemInput {
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
  static async getOrCreateCart(customerId?: string, sessionId?: string) {
    const tenantId = requireTenantId();

    if (customerId) {
      let cart = await prisma.commerceCart.findFirst({
        where: { tenantId, customerId },
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
      where: { tenantId, sessionId: sessionId! },
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

  static async getCart(customerId?: string, sessionId?: string) {
    return this.getOrCreateCart(customerId, sessionId);
  }

  static async addItemToCart(input: AddItemInput) {
    const { customerId, sessionId, productVariantId, quantity } = input;
    const tenantId = requireTenantId();

    if (quantity <= 0) {
      throw new Error('Quantity must be greater than 0');
    }

    const cart = await this.getOrCreateCart(customerId, sessionId);

    const variant = await prisma.catalogProductVariant.findFirst({
      where: { id: productVariantId, tenantId },
    });

    if (!variant) {
      throw new Error('Product variant not found');
    }

    const effectiveStock = await InventoryRepository.getEffectiveAvailableStock(
      tenantId,
      productVariantId,
    );

    const existingItem = await prisma.commerceCartItem.findUnique({
      where: {
        cartId_productVariantId: {
          cartId: cart.id,
          productVariantId,
        },
      },
    });

    const newQuantity = existingItem ? existingItem.quantity + quantity : quantity;
    if (effectiveStock.available < newQuantity) {
      throw new Error(`Insufficient stock. Only ${effectiveStock.available} available.`);
    }

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
          tenantId: cart.tenantId,
          cartId: cart.id,
          productVariantId,
          quantity,
          unitPrice: variant.price,
        },
      });
    }

    return this.getOrCreateCart(customerId, sessionId);
  }

  static async addItem(input: AddItemInput) {
    return this.addItemToCart(input);
  }

  static async updateCartItemQuantity(cartItemId: string, quantity: number, _owner: CartOwner) {
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

  static async removeItem(
    tenantId: string,
    itemId: string,
    customerId?: string,
    sessionId?: string,
  ) {
    return this.removeItemFromCart(itemId, { customerId, sessionId });
  }
}

export default CartService;
