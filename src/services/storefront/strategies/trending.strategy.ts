import { StorefrontContext, StorefrontStrategy } from './storefront-strategy.interface';
import { StorefrontProductDto, StorefrontRawSection } from '../dto/storefront.dto';
import { mapProductToDto } from '../mapper/storefront.mapper';
import { prisma } from '../../../utils/prisma';

/**
 * TrendingStrategy — merges merchant-pinned (boosted) products with analytics-driven trending.
 */
export class TrendingStrategy implements StorefrontStrategy {
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

    const analyticsRows = await prisma.analyticsProductSales.findMany({
      where: {
        tenantId: context.tenantId,
        productId: { notIn: Array.from(pinnedIds) },
      },
      orderBy: [{ totalSold: 'desc' }],
      take: remaining,
      include: {
        product: {
          include: {
            media: { where: { isPrimary: true }, take: 1 },
            variants: { take: 1 },
          },
        },
      },
    });

    const dynamic = analyticsRows
      .filter((row) => row.product)
      .map((row) => mapProductToDto(row.product));

    return [...pinned, ...dynamic];
  }
}
