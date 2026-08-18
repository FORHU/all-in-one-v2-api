import { CatalogProductMedia, Prisma } from '@prisma/client';
import {
  AdminProductListingRow,
  ProductDetailRow,
  ProductListingRow,
  ProductVariantRow,
} from '../../product.repository';
import {
  AdminProductListingItemDto,
  AdminProductMediaDto,
  AdminProductVariantDto,
  ProductAttributeOptionDto,
  ProductDetailDto,
  ProductListingItemDto,
  ProductVariantStockDto,
} from '../dto/product-listing.dto';

function toNumber(value: Prisma.Decimal | number | null | undefined): number | null {
  if (value == null) return null;
  if (typeof value === 'number') return value;
  if (typeof (value as Prisma.Decimal).toNumber === 'function')
    return (value as Prisma.Decimal).toNumber();
  const num = Number(value);
  return isNaN(num) ? null : num;
}

/**
 * De-duplicates a product's variant-attribute options by attribute code.
 * Typed structurally on just `variants` (not the full ProductListingRow) so
 * it also accepts ProductDetailRow — both LISTING_INCLUDE and DETAIL_INCLUDE
 * define `variants` identically.
 */
function collectAttributeOptions(
  product: { variants: ProductListingRow['variants'] },
  attributeCode: 'color' | 'size',
): ProductAttributeOptionDto[] {
  const seen = new Map<string, ProductAttributeOptionDto>();

  for (const variant of product.variants) {
    for (const va of variant.variantAttributes) {
      if (va.value.attribute.code !== attributeCode) continue;
      if (!seen.has(va.value.value)) {
        seen.set(va.value.value, {
          value: va.value.value,
          label: va.value.label,
          ...(attributeCode === 'color' ? { swatchColor: va.value.swatchColor } : {}),
        });
      }
    }
  }

  return Array.from(seen.values());
}

/**
 * Total sellable stock for a variant.
 *
 * First-party/warehouse-tracked variants have real InventoryStock rows —
 * summed across every location (warehouse, regional, flagship, pop-up,
 * etc.); `available` is already onHand minus reserved, so no further
 * adjustment needed there.
 *
 * Dropship/print-on-demand variants have no warehouse at all, so no
 * InventoryStock rows ever exist for them — stock instead falls back to the
 * linked SupplierVariant's last-synced count (see ProductImportService /
 * InventoryRepository.getEffectiveAvailableStock, which this mirrors for
 * the read path).
 */
function sumAvailableStock(variant: {
  inventoryStocks: { available: number }[];
  supplierVariants: { stock: number | null }[];
}): number {
  if (variant.inventoryStocks.length > 0) {
    return variant.inventoryStocks.reduce((sum, s) => sum + s.available, 0);
  }
  return variant.supplierVariants.reduce((max, sv) => Math.max(max, sv.stock ?? 0), 0);
}

/** Per-variant stock, tagged with its color/size values so the PDP can look up the count for whatever the shopper currently has selected. */
function collectVariantStock(product: ProductDetailRow): ProductVariantStockDto[] {
  return product.variants.map((variant) => {
    let color: string | null = null;
    let size: string | null = null;

    for (const va of variant.variantAttributes) {
      if (va.value.attribute.code === 'color') color = va.value.value;
      if (va.value.attribute.code === 'size') size = va.value.value;
    }

    return { color, size, stock: sumAvailableStock(variant) };
  });
}

export function mapProductToListingDto(
  product: ProductListingRow,
  rating?: { rating: number; reviewCount: number },
): ProductListingItemDto {
  const primaryMedia = product.media[0];

  return {
    id: product.id,
    slug: product.slug,
    title: product.title,
    brand: product.brand,
    thumbnailUrl: product.thumbnailUrl ?? primaryMedia?.url ?? null,
    price: toNumber(product.price),
    salePrice: toNumber(product.salePrice),
    compareAtPrice: toNumber(product.compareAtPrice),
    rating: rating?.rating ?? 0,
    reviewCount: rating?.reviewCount ?? 0,
    colors: collectAttributeOptions(product, 'color'),
    sizes: collectAttributeOptions(product, 'size'),
    inStock: product.variants.some((v) => sumAvailableStock(v) > 0),
    categoryId: product.categoryId,
    createdAt: product.createdAt,
  };
}

/** Lowest supplier cost across a product's variants, or null if none have one (never imported). */
function lowestBaseCost(product: {
  variants: { baseCost: Prisma.Decimal | null }[];
}): number | null {
  const costs = product.variants
    .map((v) => toNumber(v.baseCost))
    .filter((c): c is number => c !== null);
  return costs.length > 0 ? Math.min(...costs) : null;
}

export function mapProductToAdminListingDto(
  product: AdminProductListingRow,
): AdminProductListingItemDto {
  const primaryMedia = product.media.find((m) => m.isPrimary) ?? product.media[0];

  return {
    id: product.id,
    slug: product.slug,
    title: product.title,
    brand: product.brand,
    status: product.status,
    visibility: product.visibility,
    thumbnailUrl: product.thumbnailUrl ?? primaryMedia?.url ?? null,
    price: toNumber(product.price),
    salePrice: toNumber(product.salePrice),
    compareAtPrice: toNumber(product.compareAtPrice),
    originalPrice: lowestBaseCost(product),
    category: product.category,
    pricingRule: product.pricingRule,
    variantCount: product._count.variants,
    inStock: product.variants.some((v) => sumAvailableStock(v) > 0),
    images: product.media.map((m) => m.url),
    createdBy: product.createdBy,
    updatedBy: product.updatedBy,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

export function mapVariantToAdminDto(variant: ProductVariantRow): AdminProductVariantDto {
  let color: string | null = null;
  let size: string | null = null;

  for (const va of variant.variantAttributes) {
    if (va.value.attribute.code === 'color') color = va.value.value;
    if (va.value.attribute.code === 'size') size = va.value.value;
  }

  return {
    id: variant.id,
    sku: variant.sku,
    title: variant.title,
    price: toNumber(variant.price) ?? 0,
    compareAtPrice: toNumber(variant.compareAtPrice),
    color,
    size,
    stockAvailable: sumAvailableStock(variant),
    thumbnailUrl: variant.media[0]?.url ?? null,
  };
}

export function mapMediaToAdminDto(media: CatalogProductMedia): AdminProductMediaDto {
  return {
    id: media.id,
    url: media.url,
    type: media.type,
    altText: media.altText,
    position: media.position,
    isPrimary: media.isPrimary,
  };
}

export function mapProductToDetailDto(
  product: ProductDetailRow,
  rating?: { rating: number; reviewCount: number },
): ProductDetailDto {
  // Real gallery images (CatalogProductMedia) win when present; today's
  // seed data doesn't populate that table, so this falls back to the single
  // thumbnailUrl — the frontend gallery adapts to however many images it
  // actually gets rather than assuming a fixed count.
  const galleryUrls = product.media.map((m) => m.url);
  const images =
    galleryUrls.length > 0 ? galleryUrls : product.thumbnailUrl ? [product.thumbnailUrl] : [];

  return {
    id: product.id,
    slug: product.slug,
    title: product.title,
    brand: product.brand,
    thumbnailUrl: product.thumbnailUrl ?? images[0] ?? null,
    description: product.description,
    images,
    price: toNumber(product.price),
    salePrice: toNumber(product.salePrice),
    compareAtPrice: toNumber(product.compareAtPrice),
    rating: rating?.rating ?? 0,
    reviewCount: rating?.reviewCount ?? 0,
    colors: collectAttributeOptions(product, 'color'),
    sizes: collectAttributeOptions(product, 'size'),
    inStock: product.variants.some((v) => sumAvailableStock(v) > 0),
    variants: collectVariantStock(product),
    categoryId: product.categoryId,
    categorySlug: product.category?.slug ?? null,
    categoryName: product.category?.name ?? null,
    createdAt: product.createdAt,
  };
}
