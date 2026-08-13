import { Prisma, ProductStatus } from '@prisma/client';
import { prisma } from '../../utils/prisma';
import { buildPage, PageResult } from '../../helpers/pagination.helper';

export interface ProductListingFilters {
  categoryIds?: string[];
  brands?: string[];
  colorValues?: string[];
  sizeValues?: string[];
  priceMin?: number;
  priceMax?: number;
  sort: 'newest' | 'price-asc' | 'price-desc' | 'popularity';
  page: number;
  limit: number;
}

const LISTING_INCLUDE = {
  media: { where: { isPrimary: true }, take: 1 },
  variants: {
    where: { deletedAt: null },
    include: {
      variantAttributes: {
        include: { value: { include: { attribute: true } } },
      },
      // Stock now lives on InventoryStock (multi-location), not directly on
      // the variant — see prisma/schema/inventory.prisma.
      inventoryStocks: { select: { available: true } },
    },
  },
} satisfies Prisma.CatalogProductInclude;

export type ProductListingRow = Prisma.CatalogProductGetPayload<{
  include: typeof LISTING_INCLUDE;
}>;

const DETAIL_INCLUDE = {
  media: { orderBy: { position: 'asc' } },
  variants: {
    where: { deletedAt: null },
    include: {
      variantAttributes: {
        include: { value: { include: { attribute: true } } },
      },
      inventoryStocks: { select: { available: true } },
    },
  },
  category: { select: { name: true, slug: true } },
} satisfies Prisma.CatalogProductInclude;

export type ProductDetailRow = Prisma.CatalogProductGetPayload<{
  include: typeof DETAIL_INCLUDE;
}>;

const ADMIN_LISTING_INCLUDE = {
  category: { select: { id: true, name: true } },
  media: { where: { isPrimary: true }, take: 1 },
  variants: {
    where: { deletedAt: null },
    select: { id: true, inventoryStocks: { select: { available: true } } },
  },
  _count: { select: { variants: { where: { deletedAt: null } } } },
} satisfies Prisma.CatalogProductInclude;

export type AdminProductListingRow = Prisma.CatalogProductGetPayload<{
  include: typeof ADMIN_LISTING_INCLUDE;
}>;

/**
 * Every method takes `tenantId` explicitly ΓÇö see CategoryRepository for the
 * same convention. Products live one level below Tenant in the isolation
 * model, so every query is tenant-scoped from the base `where` up.
 */
export default class ProductRepository {
  // Fields the admin products table can sort by ΓÇö same whitelist reasoning
  // as CustomerRepository.SORTABLE_FIELDS.
  private static readonly ADMIN_SORTABLE_FIELDS = new Set([
    'createdAt',
    'updatedAt',
    'title',
    'price',
    'status',
    'brand',
  ]);

  /**
   * Paginated list for the admin products table. Unlike `findManyForListing`
   * (the public storefront listing), this returns products in every status ΓÇö
   * DRAFT/READY/ARCHIVED included ΓÇö so merchants can manage a product before
   * it's published, and requires no category/color/size faceting.
   */
  static async findAllForAdmin(
    tenantId: string,
    page = 1,
    limit = 20,
    search?: string,
    sortBy?: string,
    sortOrder?: 'asc' | 'desc',
    status?: ProductStatus,
    categoryId?: string,
    brand?: string,
  ): Promise<PageResult<AdminProductListingRow>> {
    const where: Prisma.CatalogProductWhereInput = {
      tenantId,
      deletedAt: null,
      ...(status && { status }),
      ...(categoryId && { categoryId }),
      // Exact match, deliberately distinct from `search`'s substring OR —
      // this is "show only this brand" (from a Brand tile click), not a
      // free-text guess.
      ...(brand && { brand }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { slug: { contains: search, mode: 'insensitive' } },
          { brand: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const orderBy: Prisma.CatalogProductOrderByWithRelationInput =
      sortBy && this.ADMIN_SORTABLE_FIELDS.has(sortBy)
        ? { [sortBy]: sortOrder ?? 'asc' }
        : { createdAt: 'desc' };

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      prisma.catalogProduct.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: ADMIN_LISTING_INCLUDE,
      }),
      prisma.catalogProduct.count({ where }),
    ]);

    return buildPage(items, total, { page, limit, sortBy, sortOrder, search });
  }

  private static buildWhere(
    tenantId: string,
    filters: ProductListingFilters,
  ): Prisma.CatalogProductWhereInput {
    const where: Prisma.CatalogProductWhereInput = {
      tenantId,
      status: ProductStatus.PUBLISHED,
      deletedAt: null,
    };

    // `undefined` = no category filter at all. An explicit `[]` (e.g. a
    // categorySlug that didn't resolve to any category) must still narrow the
    // query to zero rows rather than being treated as "no filter" ΓÇö Prisma's
    // `{ in: [] }` does exactly that.
    if (filters.categoryIds !== undefined) {
      where.categoryId = { in: filters.categoryIds };
    }

    if (filters.brands && filters.brands.length > 0) {
      where.brand = { in: filters.brands };
    }

    if (filters.priceMin != null || filters.priceMax != null) {
      where.price = {
        ...(filters.priceMin != null ? { gte: filters.priceMin } : {}),
        ...(filters.priceMax != null ? { lte: filters.priceMax } : {}),
      };
    }

    // Loose match: the product qualifies if SOME variant is the selected
    // color AND SOME variant is the selected size ΓÇö not necessarily the same
    // variant. Confirmed acceptable for listing-level filtering.
    if (filters.colorValues && filters.colorValues.length > 0) {
      where.variants = {
        ...(where.variants as Prisma.CatalogProductVariantListRelationFilter),
        some: {
          ...((where.variants as Prisma.CatalogProductVariantListRelationFilter)?.some ?? {}),
          variantAttributes: {
            some: { value: { value: { in: filters.colorValues }, attribute: { code: 'color' } } },
          },
        },
      };
    }

    if (filters.sizeValues && filters.sizeValues.length > 0) {
      const sizeCondition: Prisma.CatalogProductVariantWhereInput = {
        variantAttributes: {
          some: { value: { value: { in: filters.sizeValues }, attribute: { code: 'size' } } },
        },
      };
      // AND'd as an independent `some` clause so it doesn't collapse into the
      // color condition above (which would force a single variant to match
      // both ΓÇö the strict-match behavior we deliberately did not choose).
      where.AND = [
        ...((where.AND as Prisma.CatalogProductWhereInput[]) ?? []),
        { variants: { some: sizeCondition } },
      ];
    }

    return where;
  }

  private static buildOrderBy(
    sort: ProductListingFilters['sort'],
  ): Prisma.CatalogProductOrderByWithRelationInput {
    switch (sort) {
      case 'price-asc':
        return { price: 'asc' };
      case 'price-desc':
        return { price: 'desc' };
      case 'popularity':
        return { reviews: { _count: 'desc' } };
      case 'newest':
      default:
        return { createdAt: 'desc' };
    }
  }

  /** Tenant-scoped lookup by id, unfiltered by status — for admin create/update/delete existence checks. */
  static async findById(tenantId: string, id: string) {
    return prisma.catalogProduct.findFirst({ where: { id, tenantId } });
  }

  /** Same shape as findAllForAdmin's rows — used to return a freshly created/updated product decorated the same way the admin table expects. */
  static async findByIdForAdmin(
    tenantId: string,
    id: string,
  ): Promise<AdminProductListingRow | null> {
    return prisma.catalogProduct.findFirst({
      where: { id, tenantId },
      include: ADMIN_LISTING_INCLUDE,
    });
  }

  /** Tenant-scoped lookup by slug, unfiltered by status — for slug-uniqueness checks on create. */
  static async findBySlug(tenantId: string, slug: string) {
    return prisma.catalogProduct.findUnique({ where: { tenantId_slug: { tenantId, slug } } });
  }

  // Unchecked variants used deliberately (not CatalogProductCreateInput/
  // UpdateInput) — the "checked" input types only accept relation-connect
  // syntax for categoryId/pricingRuleId/taxClassId (e.g. `category: {
  // connect: { ... } }`), not the plain scalar FK fields callers pass here.
  static async create(
    tenantId: string,
    data: Omit<Prisma.CatalogProductUncheckedCreateInput, 'tenantId'>,
  ) {
    return prisma.catalogProduct.create({
      data: { ...data, tenantId },
    });
  }

  static async update(
    tenantId: string,
    id: string,
    data: Prisma.CatalogProductUncheckedUpdateManyInput,
  ) {
    // updateMany rather than update: it accepts a non-unique where clause, so
    // the tenant filter is enforced by the database rather than assumed.
    await prisma.catalogProduct.updateMany({ where: { id, tenantId }, data });
    return this.findById(tenantId, id);
  }

  static async softDelete(tenantId: string, id: string) {
    return prisma.catalogProduct.updateMany({
      where: { id, tenantId },
      data: { deletedAt: new Date() },
    });
  }

  /** Product detail page — unlike listing, pulls the FULL media gallery (not just the primary image). */
  static async findBySlugForDetail(
    tenantId: string,
    slug: string,
  ): Promise<ProductDetailRow | null> {
    return prisma.catalogProduct.findFirst({
      where: { tenantId, slug, status: ProductStatus.PUBLISHED, deletedAt: null },
      include: DETAIL_INCLUDE,
    });
  }

  static async findManyForListing(
    tenantId: string,
    filters: ProductListingFilters,
  ): Promise<PageResult<ProductListingRow>> {
    const where = this.buildWhere(tenantId, filters);
    const orderBy = this.buildOrderBy(filters.sort);
    const { page, limit } = filters;
    const skip = (page - 1) * limit;

    // paginate() from pagination.helper.ts can't be used here ΓÇö its
    // PaginatableDelegate interface doesn't structurally match Prisma's real
    // conditional findMany overloads once an `include` is involved (confirmed:
    // no other repository in this codebase combines paginate() with include).
    // This is the helper's own documented fallback pattern (see the "Usage
    // (new endpoints)" comment at the top of pagination.helper.ts) ΓÇö same
    // skip/take math and buildPage() envelope, just called directly.
    const [items, total] = await Promise.all([
      prisma.catalogProduct.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: LISTING_INCLUDE,
      }),
      prisma.catalogProduct.count({ where }),
    ]);

    return buildPage(items, total, { page, limit });
  }

  /**
   * BFS walk over the self-referencing category tree. Returns the root plus
   * every descendant id. Resolves to just `[rootCategoryId]` for tenants
   * whose taxonomy is currently flat (e.g. fashion today), but implemented
   * generically since the schema supports arbitrary nesting.
   */
  static async findDescendantCategoryIds(
    tenantId: string,
    rootCategoryId: string,
  ): Promise<string[]> {
    const allIds = [rootCategoryId];
    let currentLevelIds = [rootCategoryId];

    while (currentLevelIds.length > 0) {
      const children = await prisma.catalogCategory.findMany({
        where: { tenantId, parentId: { in: currentLevelIds }, deletedAt: null },
        select: { id: true },
      });
      if (children.length === 0) break;
      const childIds = children.map((c: { id: string }) => c.id);
      allIds.push(...childIds);
      currentLevelIds = childIds;
    }

    return allIds;
  }

  static async findCategoryIdBySlug(tenantId: string, slug: string): Promise<string | null> {
    const category = await prisma.catalogCategory.findUnique({
      where: { tenantId_slug: { tenantId, slug } },
      select: { id: true },
    });
    return category?.id ?? null;
  }

  /**
   * Facets reflect the SAME filtered context as the listing query (minus
   * pagination), so the sidebar only ever offers choices that actually exist
   * within the current filter/category selection.
   */
  static async getFacets(tenantId: string, filters: ProductListingFilters) {
    const baseWhere = this.buildWhere(tenantId, { ...filters, page: 1, limit: 1 });
    // Price bounds must exclude the price filter's own effect on itself ΓÇö
    // otherwise narrowing the slider would immediately collapse its own
    // min/max to match the current selection, making it impossible to widen
    // back. Brand/color/size facets stay scoped by the full filter set
    // (including price) since narrowing THOSE by price is desired.
    const priceWhere = this.buildWhere(tenantId, {
      ...filters,
      priceMin: undefined,
      priceMax: undefined,
      page: 1,
      limit: 1,
    });

    const [priceAgg, brandRows, colorValues, sizeValues] = await Promise.all([
      prisma.catalogProduct.aggregate({
        where: priceWhere,
        _min: { price: true },
        _max: { price: true },
      }),
      prisma.catalogProduct.findMany({
        where: { ...baseWhere, brand: { not: null } },
        distinct: ['brand'],
        select: { brand: true },
      }),
      prisma.catalogAttributeValue.findMany({
        where: {
          attribute: { tenantId, code: 'color' },
          variants: { some: { variant: { product: baseWhere } } },
        },
        distinct: ['value'],
        select: { value: true, label: true, swatchColor: true },
      }),
      prisma.catalogAttributeValue.findMany({
        where: {
          attribute: { tenantId, code: 'size' },
          variants: { some: { variant: { product: baseWhere } } },
        },
        distinct: ['value'],
        select: { value: true, label: true },
      }),
    ]);

    return {
      priceMin: priceAgg._min.price?.toNumber() ?? null,
      priceMax: priceAgg._max.price?.toNumber() ?? null,
      brands: brandRows.map((r) => r.brand).filter((b): b is string => Boolean(b)),
      colors: colorValues,
      sizes: sizeValues,
    };
  }

  /**
   * Average rating + review count for a specific set of product ids only
   * (the current page, not the whole matching result set) ΓÇö no N+1, no
   * denormalized column needed.
   */
  static async getRatingsForProducts(productIds: string[]) {
    if (productIds.length === 0) return new Map<string, { rating: number; reviewCount: number }>();

    const grouped = await prisma.productReview.groupBy({
      by: ['productId'],
      where: { productId: { in: productIds } },
      _avg: { rating: true },
      _count: { rating: true },
    });

    return new Map(
      grouped.map(
        (g: { productId: string; _avg: { rating: number | null }; _count: { rating: number } }) => [
          g.productId,
          { rating: g._avg.rating ?? 0, reviewCount: g._count.rating },
        ],
      ),
    );
  }

  /**
   * Catalog-wide status breakdown for the admin stats bar — deliberately
   * unfiltered by the current search/status query params (unlike
   * findAllForAdmin's `total`), so the overview cards stay stable while the
   * admin filters the table below them.
   */
  static async getStatusCounts(tenantId: string): Promise<Record<ProductStatus, number>> {
    const grouped = await prisma.catalogProduct.groupBy({
      by: ['status'],
      where: { tenantId, deletedAt: null },
      _count: { status: true },
    });

    const counts = Object.fromEntries(
      Object.values(ProductStatus).map((status) => [status, 0]),
    ) as Record<ProductStatus, number>;

    grouped.forEach((g: { status: ProductStatus; _count: { status: number } }) => {
      counts[g.status] = g._count.status;
    });

    return counts;
  }

  /**
   * Distinct brand values in use across this tenant's products, with a
   * per-brand product count. Brand has no table of its own — it's a plain
   * `brand: string | null` column on catalog_products — so this is a
   * groupBy over that column rather than a join, and null/blank brands are
   * excluded (nothing meaningful to manage there).
   */
  static async getBrandCounts(tenantId: string): Promise<{ brand: string; count: number }[]> {
    const grouped = await prisma.catalogProduct.groupBy({
      by: ['brand'],
      where: { tenantId, deletedAt: null, brand: { not: null } },
      _count: { brand: true },
      orderBy: { brand: 'asc' },
    });

    return grouped.map((g: { brand: string | null; _count: { brand: number } }) => ({
      brand: g.brand as string,
      count: g._count.brand,
    }));
  }

  /**
   * Bulk-rewrites every product's `brand` field from one value to another
   * (or to null, to clear it) — the closest thing to "rename"/"delete" for
   * a value that has no row of its own to rename/delete. Uses `updateMany`
   * with an exact-match `brand` filter, same tenant-scoping convention as
   * every other write in this repository.
   */
  static async renameBrand(
    tenantId: string,
    brand: string,
    newBrand: string | null,
  ): Promise<number> {
    const result = await prisma.catalogProduct.updateMany({
      where: { tenantId, deletedAt: null, brand },
      data: { brand: newBrand },
    });
    return result.count;
  }
}
