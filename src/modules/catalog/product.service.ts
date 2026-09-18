import { ProductStatus, ProductVisibility } from '@prisma/client';
import ProductRepository, { ProductListingFilters, ProductListingRow } from './product.repository';
import { requireTenantId } from '../../utils/async-context';
import { throwResponse } from '../../utils/throw-response';
import { deleteFromS3 } from '../../utils/s3.util';
import logger from '../../utils/logger';
import { prisma } from '../../utils/prisma';
import AttributeRepository from './attribute.repository';
import PricingRuleRepository from './pricing-rule.repository';
import PricingRuleService from './pricing-rule.service';
import { MediaType } from '@prisma/client';
import {
  mapMediaToAdminDto,
  mapProductToAdminListingDto,
  mapProductToDetailDto,
  mapProductToListingDto,
  mapVariantToAdminDto,
} from './product/mapper/product.mapper';

export interface VariantWriteInput {
  title: string;
  price: number;
  compareAtPrice?: number | null;
  sku?: string | null;
  color?: string | null;
  size?: string | null;
}

export interface MediaWriteInput {
  url: string;
  type?: MediaType;
  altText?: string | null;
  position?: number;
  isPrimary?: boolean;
}

export interface ProductWriteInput {
  title: string;
  slug?: string;
  description?: string;
  // Nullable (not just optional): the admin form needs to be able to send an
  // explicit `null` to CLEAR one of these on an existing product, which an
  // omitted/`undefined` key can't express — `undefined` fields are dropped
  // by JSON.stringify before the request body is even sent, so the backend
  // would never see the field was touched at all.
  brand?: string | null;
  status?: ProductStatus;
  visibility?: ProductVisibility;
  featured?: boolean;
  price?: number | null;
  salePrice?: number | null;
  compareAtPrice?: number | null;
  thumbnailUrl?: string | null;
  categoryId?: string | null;
  tags?: string[];
  seoTitle?: string;
  seoDescription?: string;
  // Nullable: an explicit `null` clears any pricing rule (variants keep
  // their last-calculated price, no further markup applied). `undefined`
  // on create means "use the tenant's default rule, if any" — see
  // ProductService.createProduct.
  pricingRuleId?: string | null;
}

/** "Classic Denim Jacket" -> "classic-denim-jacket" */
function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export interface ListProductsQuery {
  categorySlug?: string;
  brands?: string[];
  colorValues?: string[];
  sizeValues?: string[];
  season?: string;
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
      // Stored uppercase on CatalogCollection.metadata (e.g. "SPRING") —
      // the public query param stays lowercase like every other filter.
      season: query.season?.toUpperCase(),
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
    categoryId?: string,
    brand?: string,
    hasPricingRule?: boolean,
  ) {
    const tenantId = requireTenantId();
    const [result, statusCounts] = await Promise.all([
      ProductRepository.findAllForAdmin(
        tenantId,
        page,
        limit,
        search,
        sortBy,
        sortOrder,
        status,
        categoryId,
        brand,
        hasPricingRule,
      ),
      ProductRepository.getStatusCounts(tenantId),
    ]);
    return {
      ...result,
      items: result.items.map(mapProductToAdminListingDto),
      statusCounts,
    };
  }

  /**
   * GET /api/v2/products/:id/admin — single-product fetch in the same admin
   * shape listProductsForAdmin/createProduct/updateProduct return, for a
   * caller that only has a product id (e.g. a collection item row) and needs
   * the full editable record rather than the narrow denormalized slice a
   * collection item carries.
   */
  static async getProductByIdForAdmin(id: string) {
    const tenantId = requireTenantId();
    const product = await ProductRepository.findByIdForAdmin(tenantId, id);
    if (!product) return throwResponse(404, 'Product not found');
    return mapProductToAdminListingDto(product);
  }

  static async getBrandCounts() {
    const tenantId = requireTenantId();
    return ProductRepository.getBrandCounts(tenantId);
  }

  /**
   * Bulk-renames (or, with `newBrand: null`, clears) a brand across every
   * product that carries it. `brand` has no table of its own to look up, so
   * unlike updateCategory/updateCollection there's no existence check —
   * an unmatched brand just updates 0 rows.
   */
  static async renameBrand(brand: string, newBrand: string | null) {
    const tenantId = requireTenantId();

    const trimmedBrand = brand.trim();
    if (!trimmedBrand) {
      return throwResponse(400, 'Brand is required');
    }

    const trimmedNewBrand = newBrand?.trim() || null;
    const updatedCount = await ProductRepository.renameBrand(
      tenantId,
      trimmedBrand,
      trimmedNewBrand,
    );
    return { updatedCount };
  }

  static async getProductBySlug(slug: string) {
    const tenantId = requireTenantId();
    const product = await ProductRepository.findBySlugForDetail(tenantId, slug);
    if (!product) return null;

    const ratings = await ProductRepository.getRatingsForProducts([product.id]);
    return mapProductToDetailDto(product, ratings.get(product.id));
  }

  static async createProduct(data: ProductWriteInput) {
    const tenantId = requireTenantId();

    const slug = data.slug ? slugify(data.slug) : slugify(data.title);
    const existing = await ProductRepository.findBySlug(tenantId, slug);
    if (existing) {
      return throwResponse(400, `Product slug '${slug}' already exists`);
    }

    // `pricingRuleId === undefined` means the form never touched it — fall
    // back to the tenant's default rule (if one exists) rather than leaving
    // the product unpriced-by-rule. An explicit `null` still means "no rule".
    let pricingRuleId = data.pricingRuleId;
    if (pricingRuleId === undefined) {
      const defaultRule = await PricingRuleRepository.findDefault(tenantId);
      pricingRuleId = defaultRule?.id ?? null;
    }

    const created = await ProductRepository.create(tenantId, { ...data, slug, pricingRuleId });
    const withAdminShape = await ProductRepository.findByIdForAdmin(tenantId, created.id);
    return mapProductToAdminListingDto(withAdminShape!);
  }

  static async updateProduct(id: string, data: Partial<ProductWriteInput>) {
    const tenantId = requireTenantId();

    const product = await ProductRepository.findById(tenantId, id);
    if (!product) {
      return throwResponse(404, 'Product not found');
    }

    if (data.slug && data.slug !== product.slug) {
      const slug = slugify(data.slug);
      const existing = await ProductRepository.findBySlug(tenantId, slug);
      if (existing) {
        return throwResponse(400, `Product slug '${slug}' already exists`);
      }
      data = { ...data, slug };
    }

    const previousThumbnailUrl = product.thumbnailUrl;
    await ProductRepository.update(tenantId, id, data);

    // Replacing (or clearing) the thumbnail orphans the old S3 object —
    // clean it up now that the new value is confirmed saved. Best-effort:
    // this must never fail the update response itself, and it silently
    // no-ops on a pasted external URL we never uploaded (e.g. a supplier's
    // CDN link).
    if (
      data.thumbnailUrl !== undefined &&
      data.thumbnailUrl !== previousThumbnailUrl &&
      previousThumbnailUrl
    ) {
      deleteFromS3(previousThumbnailUrl).catch((err) => {
        logger.warn(`Failed to delete replaced product thumbnail from S3: ${err.message}`);
      });
    }

    // A different pricing rule (or none at all) was explicitly chosen —
    // recompute this product's prices right away rather than waiting for
    // the next import/resync to notice.
    if (data.pricingRuleId !== undefined && data.pricingRuleId !== product.pricingRuleId) {
      await PricingRuleService.recalculateProductPricing(tenantId, id);
    }

    const withAdminShape = await ProductRepository.findByIdForAdmin(tenantId, id);
    return mapProductToAdminListingDto(withAdminShape!);
  }

  static async deleteProduct(id: string) {
    const tenantId = requireTenantId();

    const product = await ProductRepository.findById(tenantId, id);
    if (!product) {
      return throwResponse(404, 'Product not found');
    }
    return ProductRepository.softDelete(tenantId, id);
  }

  // ─── Variants ──────────────────────────────────────────────────────────────

  static async listVariants(productId: string) {
    const tenantId = requireTenantId();
    const product = await ProductRepository.findById(tenantId, productId);
    if (!product) return throwResponse(404, 'Product not found');

    const variants = await ProductRepository.listVariants(tenantId, productId);
    return variants.map(mapVariantToAdminDto);
  }

  static async createVariant(productId: string, data: VariantWriteInput) {
    const tenantId = requireTenantId();
    const product = await ProductRepository.findById(tenantId, productId);
    if (!product) return throwResponse(404, 'Product not found');

    const variant = await ProductRepository.createVariant(tenantId, productId, {
      title: data.title,
      price: data.price,
      compareAtPrice: data.compareAtPrice ?? null,
      sku: data.sku ?? null,
    });

    await this.syncVariantAttributes(tenantId, variant.id, data);
    const withAttributes = await ProductRepository.findVariantById(tenantId, productId, variant.id);
    return mapVariantToAdminDto(withAttributes!);
  }

  static async updateVariant(
    productId: string,
    variantId: string,
    data: Partial<VariantWriteInput>,
  ) {
    const tenantId = requireTenantId();
    const product = await ProductRepository.findById(tenantId, productId);
    if (!product) return throwResponse(404, 'Product not found');

    const existing = await ProductRepository.findVariantById(tenantId, productId, variantId);
    if (!existing) return throwResponse(404, 'Variant not found');

    const { color, size, ...rest } = data;
    if (Object.keys(rest).length > 0) {
      await ProductRepository.updateVariant(tenantId, productId, variantId, rest);
    }

    if (color !== undefined || size !== undefined) {
      await this.syncVariantAttributes(tenantId, variantId, { color, size });
    }

    const updated = await ProductRepository.findVariantById(tenantId, productId, variantId);
    return mapVariantToAdminDto(updated!);
  }

  static async deleteVariant(productId: string, variantId: string) {
    const tenantId = requireTenantId();
    const product = await ProductRepository.findById(tenantId, productId);
    if (!product) return throwResponse(404, 'Product not found');

    const existing = await ProductRepository.findVariantById(tenantId, productId, variantId);
    if (!existing) return throwResponse(404, 'Variant not found');

    return ProductRepository.softDeleteVariant(tenantId, productId, variantId);
  }

  // ─── Media ─────────────────────────────────────────────────────────────────

  static async listMedia(productId: string) {
    const tenantId = requireTenantId();
    const product = await ProductRepository.findById(tenantId, productId);
    if (!product) return throwResponse(404, 'Product not found');

    const media = await ProductRepository.listMedia(productId);
    return media.map(mapMediaToAdminDto);
  }

  static async createMedia(productId: string, data: MediaWriteInput) {
    const tenantId = requireTenantId();
    const product = await ProductRepository.findById(tenantId, productId);
    if (!product) return throwResponse(404, 'Product not found');

    if (data.isPrimary) {
      await ProductRepository.clearPrimaryMedia(productId);
    }

    const media = await ProductRepository.createMedia(productId, {
      url: data.url,
      type: data.type ?? MediaType.IMAGE,
      altText: data.altText ?? null,
      position: data.position ?? 0,
      isPrimary: data.isPrimary ?? false,
    });

    // thumbnailUrl mirrors the primary gallery image, same convention the
    // import pipeline already uses (first image -> thumbnailUrl) — keeps the
    // form's plain Thumbnail URL field in sync instead of drifting from
    // whichever image the admin just marked primary.
    if (data.isPrimary) {
      await ProductRepository.update(tenantId, productId, { thumbnailUrl: data.url });
    }

    return mapMediaToAdminDto(media);
  }

  static async updateMedia(productId: string, mediaId: string, data: Partial<MediaWriteInput>) {
    const tenantId = requireTenantId();
    const product = await ProductRepository.findById(tenantId, productId);
    if (!product) return throwResponse(404, 'Product not found');

    const existing = await ProductRepository.findMediaById(productId, mediaId);
    if (!existing) return throwResponse(404, 'Media not found');

    if (data.isPrimary) {
      await ProductRepository.clearPrimaryMedia(productId);
    }

    const updated = await ProductRepository.updateMedia(productId, mediaId, data);

    if (data.isPrimary) {
      await ProductRepository.update(tenantId, productId, {
        thumbnailUrl: data.url ?? existing.url,
      });
    }

    return mapMediaToAdminDto(updated!);
  }

  static async deleteMedia(productId: string, mediaId: string) {
    const tenantId = requireTenantId();
    const product = await ProductRepository.findById(tenantId, productId);
    if (!product) return throwResponse(404, 'Product not found');

    const existing = await ProductRepository.findMediaById(productId, mediaId);
    if (!existing) return throwResponse(404, 'Media not found');

    return ProductRepository.deleteMedia(productId, mediaId);
  }

  /** Wires the variant editor's plain color/size fields into the real EAV tables. */
  private static async syncVariantAttributes(
    tenantId: string,
    variantId: string,
    data: { color?: string | null; size?: string | null },
  ) {
    const attrs: Record<string, string> = {};
    if (data.color) attrs.color = data.color;
    if (data.size) attrs.size = data.size;
    await AttributeRepository.upsertVariantAttributesFromLabels(prisma, tenantId, variantId, attrs);
  }
}
