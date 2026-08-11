import { Prisma } from '@prisma/client';
import {
  AdminProductListingRow,
  ProductListingRow,
} from '../../../repositories/product.repository';
import {
  AdminProductListingItemDto,
  ProductAttributeOptionDto,
  ProductListingItemDto,
} from '../dto/product-listing.dto';

function toNumber(value: Prisma.Decimal | number | null | undefined): number | null {
  if (value == null) return null;
  if (typeof value === 'number') return value;
  if (typeof (value as Prisma.Decimal).toNumber === 'function')
    return (value as Prisma.Decimal).toNumber();
  const num = Number(value);
  return isNaN(num) ? null : num;
}

/** De-duplicates a product's variant-attribute options by attribute code. */
function collectAttributeOptions(
  product: ProductListingRow,
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
    inStock: product.variants.some((v) => v.stock > 0),
    categoryId: product.categoryId,
    createdAt: product.createdAt,
  };
}

export function mapProductToAdminListingDto(
  product: AdminProductListingRow,
): AdminProductListingItemDto {
  const primaryMedia = product.media[0];

  return {
    id: product.id,
    slug: product.slug,
    title: product.title,
    // Not selected by findAllForAdmin (see AdminProductListingRow) — the
    // catalog_products.brand column doesn't exist until migration
    // 20260807071552_add_catalog_product_brand is applied.
    brand: null,
    status: product.status,
    visibility: product.visibility,
    thumbnailUrl: product.thumbnailUrl ?? primaryMedia?.url ?? null,
    price: toNumber(product.price),
    salePrice: toNumber(product.salePrice),
    compareAtPrice: toNumber(product.compareAtPrice),
    category: product.category,
    variantCount: product._count.variants,
    inStock: product.variants.some((v) => v.stock > 0),
    createdBy: product.createdBy,
    updatedBy: product.updatedBy,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}
