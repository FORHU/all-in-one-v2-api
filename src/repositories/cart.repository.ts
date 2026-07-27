import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';

export default class CartRepository {
  static async findByCustomerId(customerId: string) {
    return prisma.cart.findFirst({
      where: { customerId },
      include: {
        items: {
          include: {
            productVariant: {
              include: {
                product: true,
                images: true,
              },
            },
          },
        },
      },
    });
  }

  static async findBySessionId(sessionId: string) {
    return prisma.cart.findUnique({
      where: { sessionId },
      include: {
        items: {
          include: {
            productVariant: {
              include: {
                product: true,
                images: true,
              },
            },
          },
        },
      },
    });
  }

  static async createCart(customerId?: string, sessionId?: string) {
    return prisma.cart.create({
      data: {
        customerId,
        sessionId,
      },
      include: {
        items: true,
      },
    });
  }

  static async addOrUpdateItem(cartId: string, productVariantId: string, quantity: number, unitPrice: Prisma.Decimal | number) {
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
