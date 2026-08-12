import { StorefrontContext, StorefrontStrategy } from './storefront-strategy.interface';
import { StorefrontProductDto, StorefrontRawSection } from '../dto/storefront.dto';
import { ManualStrategy } from './manual.strategy';

/**
 * FlashSaleStrategy — returns manually pinned flash sale products.
 * Flash sale membership is managed externally via the Promotions domain.
 * TODO: When the Promotion domain grows, query active CampaignProducts here.
 */
export class FlashSaleStrategy implements StorefrontStrategy {
  private manual = new ManualStrategy();

  async build(
    section: StorefrontRawSection,
    context: StorefrontContext,
  ): Promise<StorefrontProductDto[]> {
    return this.manual.build(section, context);
  }
}
