import { requireTenantId } from '../../utils/async-context';
import ProductRepository from '../catalog/product.repository';
import { mapProductToListingDto } from '../catalog/product/mapper/product.mapper';
import ElectronicsCatalogRepository, {
  ElectronicsProductSort,
} from './electronics-catalog.repository';

export interface ElectronicsProductQuery {
  /** A DigitFriend category slug; its subcategories are included. */
  categorySlug?: string;
  sort: ElectronicsProductSort;
  priceMin?: number;
  priceMax?: number;
  /** Free-text title/brand search (every word must match). */
  search?: string;
  page: number;
  limit: number;
}

type CategoryRow = Awaited<ReturnType<typeof ElectronicsCatalogRepository.findCategories>>[number];

/** Each category's ancestor chain, itself first and its root last. */
function ancestorChains(categories: CategoryRow[]): Map<string, string[]> {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const chains = new Map<string, string[]>();
  for (const c of categories) {
    const chain = [c.id];
    let current = c;
    // Bounded walk — a malformed parent cycle can't loop forever.
    for (let depth = 0; current.parentId && byId.has(current.parentId) && depth < 20; depth++) {
      current = byId.get(current.parentId)!;
      chain.push(current.id);
    }
    chains.set(c.id, chain);
  }
  return chains;
}

/**
 * DigitFriend's storefront product listing — server-side filtered, sorted
 * and paginated, in the API's standard page envelope
 * (`{ items, total, page, limit, totalPages }`), plus the sidebar's
 * per-category counts. Runs only for the electronics tenant (enforced by
 * electronics.route.ts); `requireTenantId()` scopes every query to it.
 */
export class ElectronicsCatalogService {
  static async listProducts(query: ElectronicsProductQuery) {
    const tenantId = requireTenantId();
    const { categorySlug, sort, priceMin, priceMax, search, page, limit } = query;

    const categories = await ElectronicsCatalogRepository.findCategories(tenantId);
    const chains = ancestorChains(categories);
    const rootOf = (id: string) => {
      const chain = chains.get(id);
      return chain ? chain[chain.length - 1] : undefined;
    };

    // The selected category plus everything under it. A slug with no
    // matching category narrows to zero results rather than silently
    // showing everything — same rule as the shared catalog listing.
    let categoryIds: string[] | undefined;
    if (categorySlug) {
      const selected = categories.find((c) => c.slug === categorySlug);
      categoryIds = selected
        ? categories.filter((c) => chains.get(c.id)?.includes(selected.id)).map((c) => c.id)
        : [];
    }

    const [pageResult, counts] = await Promise.all([
      ElectronicsCatalogRepository.findPage(tenantId, {
        categoryIds,
        priceMin,
        priceMax,
        search,
        sort,
        page,
        limit,
      }),
      ElectronicsCatalogRepository.countByCategory(tenantId, { priceMin, priceMax, search }),
    ]);

    const ratings = await ProductRepository.getRatingsForProducts(
      pageResult.items.map((p) => p.id),
    );
    const items = pageResult.items.map((p) => mapProductToListingDto(p, ratings.get(p.id)));

    // Subcategory counts roll up into their root, which is what the sidebar lists.
    const countByRoot = new Map<string, number>();
    let allCount = 0;
    counts.forEach((count, categoryId) => {
      allCount += count;
      const rootId = categoryId ? rootOf(categoryId) : undefined;
      if (rootId) countByRoot.set(rootId, (countByRoot.get(rootId) ?? 0) + count);
    });

    return {
      ...pageResult,
      items,
      filters: {
        category: categorySlug ?? null,
        sort,
        priceMin: priceMin ?? null,
        priceMax: priceMax ?? null,
        q: search ?? null,
      },
      categories: categories
        .filter((c) => !c.parentId)
        .map((c) => ({ id: c.id, slug: c.slug, name: c.name, count: countByRoot.get(c.id) ?? 0 })),
      allCount,
    };
  }
}
