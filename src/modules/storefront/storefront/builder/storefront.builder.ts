import { StorefrontSectionStrategy } from '@prisma/client';
import { StrategyFactory } from '../factory/strategy.factory';
import { StorefrontContext } from '../strategies/storefront-strategy.interface';
import { StorefrontSectionResult, StorefrontRawSection } from '../dto/storefront.dto';
import CacheUtil from '../../../../utils/cache.util';

/**
 * StorefrontBuilder — sits between the Service and the Strategies.
 * Responsibilities:
 *  1. Build a rich context object from the raw request params.
 *  2. Delegate to the correct strategy via StrategyFactory.
 *  3. Apply Redis caching based on the section's cacheMinutes config.
 *
 * The Service never calls strategies directly — it calls the Builder.
 */
export class StorefrontBuilder {
  async buildSection(
    section: StorefrontRawSection,
    context: StorefrontContext,
  ): Promise<StorefrontSectionResult> {
    const strategy = section.strategy as StorefrontSectionStrategy;
    const cacheKey = this.buildCacheKey(section, context);
    const cacheTtl = (section.cacheMinutes ?? 0) * 60;

    const execute = async (): Promise<StorefrontSectionResult> => {
      const strategyInstance = StrategyFactory.get(strategy);
      const products = await strategyInstance.build(section, context);

      return {
        id: section.id,
        title: section.title,
        slug: section.slug,
        strategy: section.strategy,
        page: context.page,
        sortOrder: section.sortOrder,
        maxItems: section.maxItems,
        products,
        metadata: {
          totalFound: products.length,
          resolvedAt: new Date().toISOString(),
          strategy: section.strategy,
        },
      };
    };

    // Only cache if the section has cacheMinutes configured
    if (cacheTtl > 0) {
      return CacheUtil.remember<StorefrontSectionResult>(cacheKey, cacheTtl, execute);
    }

    return execute();
  }

  /**
   * Build a deterministic Redis cache key for this section + context combo.
   * Including context IDs ensures CATEGORY pages with different categoryIds
   * never share the same cache entry.
   */
  private buildCacheKey(section: StorefrontRawSection, context: StorefrontContext): string {
    const parts = [
      'storefront',
      context.tenantId,
      section.id,
      context.contextType ?? 'null',
      context.contextId ?? 'null',
    ];
    return parts.join(':');
  }
}
