import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';

/**
 * Carts are per-vertical: one shopper browsing fashion and beauty has two
 * independent carts. `tenantId` is required on every lookup.
 */
export default class CartRepository {
  static async findByCustomerId(tenantId: string, customerId: string) {
    return prisma.cart.findFirst({
      where: { tenantId, customerId },
      include: {
        items: {
          include: {
            productVariant: {
              include: {
                product: true,
                media: true,
              },
            },
          },
        },
      },
    });
  }

  static async findBySessionId(tenantId: string, sessionId: string) {
    return prisma.cart.findUnique({
      where: { tenantId_sessionId: { tenantId, sessionId } },
      include: {
        items: {
          include: {
            productVariant: {
              include: {
                product: true,
                media: true,
              },
            },
          },
        },
      },
    });
  }

  static async createCart(tenantId: string, customerId?: string, sessionId?: string) {
    return prisma.cart.create({
      data: {
        tenantId,
        customerId,
        sessionId,
      },
      include: {
        items: true,
      },
    });
  }

  static async addOrUpdateItem(
    cartId: string,
    productVariantId: string,
    quantity: number,
    unitPrice: Prisma.Decimal | number,
  ) {
    return prisma.cartItem.upsert({
      where: {
        cartId_productVariantId: {
          cartId,
          productVariantId,
        },
      },
      update: {
        quantity: { increment: quantity },
        unitPrice,
      },
      create: {
        cartId,
        productVariantId,
        quantity,
        unitPrice,
      },
    });
  }

  // Cart items inherit their tenant through the parent cart, which is included
  // here so the caller can check both ownership and vertical in one go.
  static async findItemById(cartItemId: string) {
    return prisma.cartItem.findUnique({
      where: { id: cartItemId },
      include: { cart: true },
    });
  }

  static async findCartById(tenantId: string, cartId: string) {
    return prisma.cart.findFirst({ where: { id: cartId, tenantId } });
  }

  static async updateItemQuantity(cartItemId: string, quantity: number) {
    if (quantity <= 0) {
      return prisma.cartItem.delete({
        where: { id: cartItemId },
      });
    }

    return prisma.cartItem.update({
      where: { id: cartItemId },
      data: { quantity },
    });
  }

  static async removeItem(cartItemId: string) {
    return prisma.cartItem.delete({
      where: { id: cartItemId },
    });
  }

  static async clearCart(cartId: string) {
    return prisma.cartItem.deleteMany({
      where: { cartId },
    });
  }
}
