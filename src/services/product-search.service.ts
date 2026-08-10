import { supplierRegistry } from '../suppliers/supplier.registry';
import CacheUtil from '../utils/cache.util';
import logger from '../utils/logger';
import { NormalizedProductSearchItem } from '../types/product-search.types';

export class ProductSearchService {
  /**
   * Search all active suppliers concurrently for the given query.
   * Caches the results for 10 minutes.
   */
  static async searchAllSuppliers(
    query: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<NormalizedProductSearchItem[]> {
    const cacheKey = `product:search:global:${query}:${page}:${limit}`;
    const ttlSeconds = 600; // 10 minutes

    return CacheUtil.remember(cacheKey, ttlSeconds, async () => {
      const activeAdapters = supplierRegistry.getAll();

      // Query all suppliers concurrently
      const results = await Promise.allSettled(
        activeAdapters.map(async (adapter) => {
          const { items } = await adapter.searchProducts(query, page, limit);
          return {
            supplierId: adapter.supplierId,
            products: items.map((p) => this.normalizeProduct(p, adapter.supplierId)),
          };
        }),
      );

      const allNormalized: NormalizedProductSearchItem[] = [];

      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          allNormalized.push(...result.value.products);
        } else {
          // Log the failure of an individual supplier without crashing the entire search request
          logger.error(`[ProductSearchService] Supplier failed during search:`, result.reason);
        }
      });

      return allNormalized;
    });
  }

  /**
   * Basic normalization logic.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static normalizeProduct(raw: any, supplierId: string): NormalizedProductSearchItem {
    let id = raw?.id || raw?.pid || raw?.productId || String(Date.now());
    let title = raw?.title || raw?.productName || raw?.productNameEn || 'Unknown Title';
    let price = raw?.sellPrice || raw?.price || raw?.costPrice || 0;
    let imageUrl = raw?.productImage || raw?.imageUrl || raw?.pic || undefined;

    if (supplierId === 'cj-dropshipping') {
      id = raw?.pid || id;
      title = raw?.productNameEn || raw?.productName || title;
      price = raw?.sellPrice || price;
      imageUrl = raw?.productImage || imageUrl;
    }

    return {
      id,
      supplierId,
      title,
      price,
      imageUrl,
      rawData: raw,
    };
  }
}
