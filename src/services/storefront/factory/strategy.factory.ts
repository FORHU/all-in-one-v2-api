import { StorefrontSectionStrategy } from '@prisma/client';
import { StorefrontStrategy } from '../strategies/storefront-strategy.interface';
import { ManualStrategy } from '../strategies/manual.strategy';
import { CollectionStrategy } from '../strategies/collection.strategy';
import { TrendingStrategy } from '../strategies/trending.strategy';
import { BestSellerStrategy } from '../strategies/best-seller.strategy';
import { NewArrivalStrategy } from '../strategies/new-arrival.strategy';
import { FeaturedStrategy } from '../strategies/featured.strategy';
import { FlashSaleStrategy } from '../strategies/flash-sale.strategy';
import { RecommendedStrategy } from '../strategies/recommended.strategy';

/**
 * StrategyFactory — returns the correct strategy instance for a given
 * StorefrontSectionStrategy enum value.
 *
 * Adding a new strategy in the future? Add one line here. That's it.
 * The rest of the service layer never changes.
 */
export class StrategyFactory {
  private static strategies: Record<StorefrontSectionStrategy, StorefrontStrategy> = {
    [StorefrontSectionStrategy.MANUAL]: new ManualStrategy(),
    [StorefrontSectionStrategy.COLLECTION]: new CollectionStrategy(),
    [StorefrontSectionStrategy.TRENDING]: new TrendingStrategy(),
    [StorefrontSectionStrategy.BEST_SELLERS]: new BestSellerStrategy(),
    [StorefrontSectionStrategy.NEW_ARRIVALS]: new NewArrivalStrategy(),
    [StorefrontSectionStrategy.FEATURED]: new FeaturedStrategy(),
    [StorefrontSectionStrategy.FLASH_SALE]: new FlashSaleStrategy(),
    [StorefrontSectionStrategy.RECOMMENDED]: new RecommendedStrategy(),
  };

  static get(strategy: StorefrontSectionStrategy): StorefrontStrategy {
    const instance = this.strategies[strategy];
    if (!instance) {
      throw new Error(`No strategy implementation found for: ${strategy}`);
    }
    return instance;
  }
}
