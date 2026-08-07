import ProductRepository, { ProductListingFilters } from '../repositories/product.repository';
import { requireTenantId } from '../utils/async-context';
import { mapProductToListingDto } from './product/mapper/product.mapper';

export interface ListProductsQuery {
  categorySlug?: string;
  brands?: string[];
  colorValues?: string[];
  sizeValues?: string[];
  priceMin?: number;
  priceMax?: number;
  sort: 'newest' | 'price-asc' | 'price-desc' | 'popularity';
  page: number;
  limit: number;
}

export default class ProductService {
  static async listProducts(query: ListProductsQuery) {
    const tenantId = requireTenantId();

    // A categorySlug that doesn't resolve to a real category (e.g. a nav
    // link like "kids"/"sale" with no backing category yet) intentionally
    // narrows to zero results rather than falling back to "show everything".
    let categoryIds: string[] | undefined;
    if (query.categorySlug) {
      const categoryId = await ProductRepository.findCategoryIdBySlug(tenantId, query.categorySlug);
      categoryIds = categoryId ? await ProductRepository.findDescendantCategoryIds(tenantId, categoryId) : [];
    }

    const filters: ProductListingFilters = {
      categoryIds,
      brands: query.brands,
      colorValues: query.colorValues,
      sizeValues: query.sizeValues,
      priceMin: query.priceMin,
      priceMax: query.priceMax,
      sort: query.sort,
      page: query.page,
      limit: query.limit,
    };

    const [pageResult, facets] = await Promise.all([
      ProductRepository.findManyForListing(tenantId, filters),
      ProductRepository.getFacets(tenantId, filters),
    ]);

    const ratings = await ProductRepository.getRatingsForProducts(pageResult.items.map((p) => p.id));
    const items = pageResult.items.map((p) => mapProductToListingDto(p, ratings.get(p.id)));

    return {
      items,
      total: pageResult.total,
      page: pageResult.page,
      limit: pageResult.limit,
      totalPages: pageResult.totalPages,
      facets,
    };
  }
}
