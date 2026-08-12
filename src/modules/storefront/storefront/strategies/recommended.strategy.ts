import { StorefrontContext, StorefrontStrategy } from './storefront-strategy.interface';
import { StorefrontProductDto, StorefrontRawSection } from '../dto/storefront.dto';
import { BestSellerStrategy } from './best-seller.strategy';

/**
 * RecommendedStrategy — personalised product recommendations.
 * Falls back to best-sellers when no customer context is available.
 * TODO: Integrate with an AI/ML recommendation engine using context.customerId.
 */
export class RecommendedStrategy implements StorefrontStrategy {
  private fallback = new BestSellerStrategy();

  async build(
    section: StorefrontRawSection,
    context: StorefrontContext,
  ): Promise<StorefrontProductDto[]> {
    if (!context.customerId) {
      return this.fallback.build(section, context);
    }
    // TODO: Personalised recommendation logic using customerId.
    return this.fallback.build(section, context);
  }
}
