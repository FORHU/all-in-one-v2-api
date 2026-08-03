import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';

export default class ReviewRepository {
  static async createReview(data: Prisma.ProductReviewCreateInput) {
    return prisma.productReview.create({
      data,
      include: { images: true },
    });
  }

  static async findByProductId(tenantId: string, productId: string) {
    return prisma.productReview.findMany({
      where: { tenantId, productId },
      include: { images: true },
    });
  }
}
