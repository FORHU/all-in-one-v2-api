import { prisma } from '../../utils/prisma';

export default class WishlistRepository {
  static async findByCustomerId(tenantId: string, customerId: string) {
    return prisma.wishlist.findFirst({
      where: { tenantId, customerId },
      include: {
        items: { include: { productVariant: true } },
      },
    });
  }

  static async createWishlist(tenantId: string, customerId: string) {
    return prisma.wishlist.create({
      data: { tenantId, customerId },
      include: {
        items: { include: { productVariant: true } },
      },
    });
  }

  static async addItem(wishlistId: string, productVariantId: string) {
    return prisma.wishlistItem.create({
      data: { wishlistId, productVariantId },
    });
  }

  static async removeItem(wishlistItemId: string) {
    return prisma.wishlistItem.delete({
      where: { id: wishlistItemId },
    });
  }
}
