import { StorefrontProductDto, StorefrontRawProduct } from '../dto/storefront.dto';

/**
 * Maps a raw Prisma CatalogProduct entity to a clean StorefrontProductDto.
 * Ensures the API shape is stable, even if DB columns change.
 */
export function mapProductToDto(product: StorefrontRawProduct): StorefrontProductDto {
  const primaryMedia = Array.isArray(product.media) ? product.media[0] : null;
  const firstVariant = Array.isArray(product.variants) ? product.variants[0] : null;

  return {
    id: product.id,
    title: product.title ?? '',
    slug: product.slug ?? '',
    thumbnailUrl: product.thumbnailUrl ?? primaryMedia?.mediaUrl ?? primaryMedia?.fileUrl ?? null,
    price: firstVariant?.price ?? product.price ?? null,
    compareAtPrice: product.compareAtPrice ?? null,
    variants: (product.variants ?? []).map((v) => ({
      id: v.id,
      price: v.price,
      sku: v.sku ?? null,
    })),
  };
}
