import { StorefrontProductDto, StorefrontRawProduct } from '../dto/storefront.dto';
import { Prisma } from '@prisma/client';

/**
 * Maps a raw Prisma CatalogProduct entity to a clean StorefrontProductDto.
 * Ensures the API shape is stable, even if DB columns change.
 */
export function mapProductToDto(product: StorefrontRawProduct): StorefrontProductDto {
  const primaryMedia = Array.isArray(product.media) ? product.media[0] : null;
  const firstVariant = Array.isArray(product.variants) ? product.variants[0] : null;

  const getPriceAsNumber = (
    priceVal: Prisma.Decimal | number | null | undefined,
  ): number | null => {
    if (priceVal == null) return null;
    if (typeof priceVal === 'number') return priceVal;
    if (typeof (priceVal as Prisma.Decimal).toNumber === 'function')
      return (priceVal as Prisma.Decimal).toNumber();
    const num = Number(priceVal);
    return isNaN(num) ? null : num;
  };

  return {
    id: product.id,
    title: product.title ?? '',
    slug: product.slug ?? '',
    thumbnailUrl:
      product.thumbnailUrl ??
      primaryMedia?.mediaUrl ??
      primaryMedia?.fileUrl ??
      primaryMedia?.url ??
      null,
    price: getPriceAsNumber(firstVariant?.price) ?? getPriceAsNumber(product.price) ?? null,
    compareAtPrice: getPriceAsNumber(product.compareAtPrice) ?? null,
    variants: (product.variants ?? []).map((v) => ({
      id: v.id,
      price: getPriceAsNumber(v.price) ?? 0,
      sku: v.sku ?? null,
    })),
  };
}
