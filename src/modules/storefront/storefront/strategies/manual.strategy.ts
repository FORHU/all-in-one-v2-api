import { StorefrontContext, StorefrontStrategy } from './storefront-strategy.interface';
import { StorefrontProductDto, StorefrontRawSection } from '../dto/storefront.dto';
import { mapProductToDto } from '../mapper/storefront.mapper';

/**
 * ManualStrategy — returns only the manually pinned items for this section.
 * Used when merchants want 100% control over a section's product list.
 */
export class ManualStrategy implements StorefrontStrategy {
  async build(
    section: StorefrontRawSection,
    context: StorefrontContext,
  ): Promise<StorefrontProductDto[]> {
    return section.pinnedItems
      .slice(0, context.maxItems)
      .map((item) => mapProductToDto(item.product));
  }
}
