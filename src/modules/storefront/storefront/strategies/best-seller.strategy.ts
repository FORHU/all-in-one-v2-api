import { StorefrontContext, StorefrontStrategy } from './storefront-strategy.interface';
import { StorefrontProductDto, StorefrontRawSection } from '../dto/storefront.dto';
import { mapProductToDto } from '../mapper/storefront.mapper';
import { prisma } from '../../../../utils/prisma';

/**
 * BestSellerStrategy — fetches products with the highest all-time total sold.
 */
export class BestSellerStrategy implements StorefrontStrategy {
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

    const rows = await prisma.analyticsProductSales.findMany({
      where: {
        tenantId: context.tenantId,
        productId: { notIn: Array.from(pinnedIds) },
      },
      orderBy: { totalSold: 'desc' },
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

    const dynamic = rows.filter((r) => r.product).map((r) => mapProductToDto(r.product));
    return [...pinned, ...dynamic];
  }
}
