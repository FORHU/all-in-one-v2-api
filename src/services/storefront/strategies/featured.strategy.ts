import { StorefrontContext, StorefrontStrategy } from './storefront-strategy.interface';
import { StorefrontProductDto, StorefrontRawSection } from '../dto/storefront.dto';
import { mapProductToDto } from '../mapper/storefront.mapper';
import { prisma } from '../../../utils/prisma';
import { ProductStatus } from '@prisma/client';

/**
 * FeaturedStrategy — fetches products explicitly flagged as featured by the merchant.
 */
export class FeaturedStrategy implements StorefrontStrategy {
  async build(
    section: StorefrontRawSection,
    context: StorefrontContext,
  ): Promise<StorefrontProductDto[]> {
    const pinnedIds = new Set(section.pinnedItems.map((i) => i.productId));
    const pinned = section.pinnedItems
      .slice(0, context.maxItems)
      .map((i) => mapProductToDto(i.product));

    const remaining = context.maxItems - pinned.length;
    if (remaining <= 0) return pinned;

    const products = await prisma.catalogProduct.findMany({
      where: {
        tenantId: context.tenantId,
        status: ProductStatus.PUBLISHED,
        featured: true,
        deletedAt: null,
        id: { notIn: Array.from(pinnedIds) },
      },
      orderBy: { createdAt: 'desc' },
      take: remaining,
      include: {
        media: { where: { isPrimary: true }, take: 1 },
        variants: { take: 1 },
      },
    });

    return [...pinned, ...products.map(mapProductToDto)];
  }
}
