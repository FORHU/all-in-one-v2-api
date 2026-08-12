import ReviewRepository from './review.repository';
import { requireTenantId } from '../../utils/async-context';
import { Prisma } from '@prisma/client';

export default class ReviewService {
  static async createReview(data: Omit<Prisma.ProductReviewCreateInput, 'tenant'>) {
    return ReviewRepository.createReview({
      ...data,
      tenant: { connect: { id: requireTenantId() } },
    });
  }

  static async getProductReviews(productId: string) {
    return ReviewRepository.findByProductId(requireTenantId(), productId);
  }
}
