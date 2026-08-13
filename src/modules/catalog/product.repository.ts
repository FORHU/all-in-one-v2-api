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

// `omit` mirrors the `findAllForAdmin` query below ΓÇö brand is excluded
// there (pending migration 20260807071552_add_catalog_product_brand), so
// the row type must exclude it too or TS considers it a required field
// that's actually missing from every row returned at runtime.
export type AdminProductListingRow = Prisma.CatalogProductGetPayload<{
  include: typeof ADMIN_LISTING_INCLUDE;
  omit: { brand: true };
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
  ): Promise<PageResult<AdminProductListingRow>> {
    const where: Prisma.CatalogProductWhereInput = {
      tenantId,
      deletedAt: null,
      ...(status && { status }),
      ...(search && {
        // `brand` intentionally excluded from this OR ΓÇö the migration that
        // adds `catalog_products.brand` (20260807071552_add_catalog_product_brand)
        // hasn't been applied yet, so referencing the column here throws.
        // Re-add once the column exists.
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { slug: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    // 'brand' is excluded from the sort whitelist for the same reason ΓÇö
    // `orderBy: { brand }` would reference the not-yet-existing column.
    const orderBy: Prisma.CatalogProductOrderByWithRelationInput =
      sortBy && sortBy !== 'brand' && this.ADMIN_SORTABLE_FIELDS.has(sortBy)
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
        // Prisma selects all scalar columns by default; `brand` is declared
        // in schema.prisma but the column doesn't exist in the database yet
        // (see OR comment above) ΓÇö omit it here or every query throws.
        omit: { brand: true },
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
}
