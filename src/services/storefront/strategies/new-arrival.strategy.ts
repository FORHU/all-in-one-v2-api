import { StorefrontContext, StorefrontStrategy } from './storefront-strategy.interface';
import { StorefrontProductDto, StorefrontRawSection } from '../dto/storefront.dto';
import { mapProductToDto } from '../mapper/storefront.mapper';
import { prisma } from '../../../utils/prisma';
import { ProductStatus } from '@prisma/client';

/**
 * NewArrivalStrategy — fetches the most recently published products.
 */
export class NewArrivalStrategy implements StorefrontStrategy {
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
        deletedAt: null,
        id: { notIn: Array.from(pinnedIds) },
        ...(context.contextType === 'CATEGORY' && context.contextId
          ? { categoryId: context.contextId }
          : {}),
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
