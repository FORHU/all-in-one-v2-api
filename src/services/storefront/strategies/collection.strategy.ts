import { StorefrontContext, StorefrontStrategy } from './storefront-strategy.interface';
import { StorefrontProductDto, StorefrontRawSection } from '../dto/storefront.dto';
import { mapProductToDto } from '../mapper/storefront.mapper';

/**
 * CollectionStrategy — passes through items from a linked CatalogCollection.
 */
export class CollectionStrategy implements StorefrontStrategy {
  async build(
    section: StorefrontRawSection,
    context: StorefrontContext,
  ): Promise<StorefrontProductDto[]> {
    if (!section.collection) return [];

    return section.collection.items
      .slice(0, context.maxItems)
      .map((item) => mapProductToDto(item.product));
  }
}
