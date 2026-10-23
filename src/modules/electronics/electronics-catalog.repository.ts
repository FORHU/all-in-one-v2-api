import { Prisma, ProductStatus } from '@prisma/client';
import { prisma } from '../../utils/prisma';
import { buildPage, PageResult } from '../../helpers/pagination.helper';
import {
  LISTING_INCLUDE,
  ProductListingRow,
  buildSearchCondition,
} from '../catalog/product.repository';

export type ElectronicsProductSort = 'newest' | 'price-asc' | 'price-desc' | 'name-asc';

export interface ElectronicsProductFilters {
  /** `undefined` = every category; `[]` = a category that matched nothing (zero results). */
  categoryIds?: string[];
  priceMin?: number;
  priceMax?: number;
  /** Free-text title/brand search — same matching as the shared listing's `q`. */
  search?: string;
  sort: ElectronicsProductSort;
  page: number;
  limit: number;
}

const ORDER_BY: Record<ElectronicsProductSort, Prisma.CatalogProductOrderByWithRelationInput[]> = {
  newest: [{ createdAt: 'desc' }],
  'price-asc': [{ price: 'asc' }],
  'price-desc': [{ price: 'desc' }],
  'name-asc': [{ title: 'asc' }],
};

/**
 * DigitFriend storefront listing queries. Every query is tenant-scoped and
 * limited to PUBLISHED, non-deleted products — same visibility rules as the
 * shared catalog listing (catalog/product.repository.ts).
 */
export default class ElectronicsCatalogRepository {
  private static buildWhere(
    tenantId: string,
    filters: Pick<ElectronicsProductFilters, 'categoryIds' | 'priceMin' | 'priceMax' | 'search'>,
  ): Prisma.CatalogProductWhereInput {
    const searchCondition = buildSearchCondition(filters.search);
    return {
      tenantId,
      status: ProductStatus.PUBLISHED,
      deletedAt: null,
      ...(filters.categoryIds !== undefined && { categoryId: { in: filters.categoryIds } }),
      ...((filters.priceMin != null || filters.priceMax != null) && {
        price: {
          ...(filters.priceMin != null && { gte: filters.priceMin }),
          ...(filters.priceMax != null && { lte: filters.priceMax }),
        },
      }),
      ...(searchCondition && { AND: [searchCondition] }),
    };
  }

  /** One page of products, in the standard `buildPage` envelope. */
  static async findPage(
    tenantId: string,
    filters: ElectronicsProductFilters,
  ): Promise<PageResult<ProductListingRow>> {
    const where = this.buildWhere(tenantId, filters);
    const { page, limit, sort } = filters;

    const [items, total] = await Promise.all([
      prisma.catalogProduct.findMany({
        where,
        // id as a final tie-breaker keeps page boundaries stable when the
        // sort key has duplicates (same price, same createdAt from a bulk import).
        orderBy: [...ORDER_BY[sort], { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: LISTING_INCLUDE,
      }),
      prisma.catalogProduct.count({ where }),
    ]);

    return buildPage(items, total, { page, limit });
  }

  /**
   * Product count per category id under the price and search filters but
   * NOT the category filter — a category sidebar keeps every count visible
   * while one category is selected. `null` = uncategorized.
   */
  static async countByCategory(
    tenantId: string,
    filters: Pick<ElectronicsProductFilters, 'priceMin' | 'priceMax' | 'search'>,
  ): Promise<Map<string | null, number>> {
    const rows = await prisma.catalogProduct.groupBy({
      by: ['categoryId'],
      where: this.buildWhere(tenantId, filters),
      _count: { _all: true },
    });
    return new Map(rows.map((r) => [r.categoryId, r._count._all]));
  }

  /** The tenant's live categories, for rolling subcategory counts up to their root. */
  static async findCategories(tenantId: string) {
    return prisma.catalogCategory.findMany({
      where: { tenantId, deletedAt: null },
      select: { id: true, slug: true, name: true, parentId: true, sortOrder: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }
}
