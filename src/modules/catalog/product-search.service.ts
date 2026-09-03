import { supplierRegistry } from '../../suppliers/supplier.registry';
import CacheUtil from '../../utils/cache.util';
import logger from '../../utils/logger';
import { NormalizedProductSearchItem } from '../../types/product-search.types';

/**
 * CJ's `sellPrice` is usually a plain numeric string ("6.63"), but for
 * multi-variant products it's a range instead ("18.00 -- 20.90") — confirmed
 * against /product/listV2 directly. Takes the low end ("from" price) and
 * coerces to a number, never NaN, so one oddly-priced product doesn't
 * corrupt the normalized result.
 */
function coercePrice(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isNaN(value) ? undefined : value;
  if (typeof value !== 'string') return undefined;
  const low = value.split('--')[0]?.trim();
  const n = Number(low);
  return Number.isNaN(n) ? undefined : n;
}

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
    const price = coercePrice(raw?.sellPrice) ?? raw?.price ?? raw?.costPrice ?? 0;
    let imageUrl = raw?.productImage || raw?.imageUrl || raw?.pic || undefined;

    if (supplierId === 'cj-dropshipping') {
      // CJ's search endpoint (/product/listV2, what searchProducts() calls)
      // and its detail endpoint (/product/query) use different field names
      // for the same data — `nameEn`/`bigImage` here, not `productNameEn`/
      // `productImage` (those belong to the detail payload). Reading the
      // detail-only names against search results left every CJ result
      // falling back to 'Unknown Title' with no image.
      id = raw?.id || raw?.pid || id;
      title = raw?.nameEn || raw?.productNameEn || raw?.productName || title;
      imageUrl = raw?.bigImage || raw?.productImage || imageUrl;
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
