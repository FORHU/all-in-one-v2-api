import { ProductStatus } from '@prisma/client';
import ProductRepository, { ProductListingFilters, ProductListingRow } from './product.repository';
import { requireTenantId } from '../../utils/async-context';
import {
  mapProductToAdminListingDto,
  mapProductToDetailDto,
  mapProductToListingDto,
} from './product/mapper/product.mapper';

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
      categoryIds = categoryId
        ? await ProductRepository.findDescendantCategoryIds(tenantId, categoryId)
        : [];
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

    const ratings = await ProductRepository.getRatingsForProducts(
      pageResult.items.map((p: { id: string }) => p.id),
    );

    const items = pageResult.items.map((p: { id: string; [key: string]: unknown }) =>
      mapProductToListingDto(
        p as unknown as ProductListingRow,
        ratings.get(p.id) as { rating: number; reviewCount: number } | undefined,
      ),
    );

    return {
      items,
      total: pageResult.total,
      page: pageResult.page,
      limit: pageResult.limit,
      totalPages: pageResult.totalPages,
      facets,
    };
  }

  static async listProductsForAdmin(
    page?: number,
    limit?: number,
    search?: string,
    sortBy?: string,
    sortOrder?: 'asc' | 'desc',
    status?: ProductStatus,
  ) {
    const result = await ProductRepository.findAllForAdmin(
      requireTenantId(),
      page,
      limit,
      search,
      sortBy,
      sortOrder,
      status,
    );
    return {
      ...result,
      items: result.items.map(mapProductToAdminListingDto),
    };
  }

  static async getProductBySlug(slug: string) {
    const tenantId = requireTenantId();
    const product = await ProductRepository.findBySlugForDetail(tenantId, slug);
    if (!product) return null;

    const ratings = await ProductRepository.getRatingsForProducts([product.id]);
    return mapProductToDetailDto(product, ratings.get(product.id));
  }
}
