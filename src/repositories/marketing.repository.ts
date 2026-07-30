import { Prisma, AdSocialPlatform, AdSocialStatus } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { buildPage, PageResult } from '../helpers/pagination.helper';

export default class MarketingRepository {
  // --- Social Feeds ---
  static async createSocialFeed(
    tenantId: string,
    data: Omit<Prisma.MarketingSocialFeedCreateInput, 'tenant'>,
  ) {
    return prisma.marketingSocialFeed.create({
      data: {
        ...data,
        tenant: { connect: { id: tenantId } },
      },
    });
  }

  static async findSocialFeedsByTenant(
    tenantId: string,
    page = 1,
    limit = 20,
  ): Promise<PageResult<unknown>> {
    const skip = (page - 1) * limit;
    const where: Prisma.MarketingSocialFeedWhereInput = { tenantId };

    const [items, total] = await Promise.all([
      prisma.marketingSocialFeed.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.marketingSocialFeed.count({ where }),
    ]);

    return buildPage(items, total, { page, limit });
  }

  static async findSocialFeedById(tenantId: string, id: string) {
    return prisma.marketingSocialFeed.findFirst({
      where: { id, tenantId },
    });
  }

  static async updateSocialFeed(
    tenantId: string,
    id: string,
    data: Prisma.MarketingSocialFeedUpdateInput,
  ) {
    return prisma.marketingSocialFeed.updateMany({
      where: { id, tenantId },
      data,
    });
  }

  // --- Social Ads ---
  static async createSocialAd(
    tenantId: string,
    productId: string,
    data: Omit<Prisma.MarketingSocialAdCreateInput, 'tenant' | 'product'>,
  ) {
    return prisma.marketingSocialAd.create({
      data: {
        ...data,
        tenant: { connect: { id: tenantId } },
        product: { connect: { id: productId } },
      },
      include: {
        product: true,
        mediaFile: true,
      },
    });
  }

  static async findSocialAdsByTenant(
    tenantId: string,
    platform?: AdSocialPlatform,
    status?: AdSocialStatus,
    page = 1,
    limit = 20,
  ): Promise<PageResult<unknown>> {
    const skip = (page - 1) * limit;
    const where: Prisma.MarketingSocialAdWhereInput = {
      tenantId,
      ...(platform ? { platform } : {}),
      ...(status ? { status } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.marketingSocialAd.findMany({
        where,
        skip,
        take: limit,
        include: {
          product: true,
          mediaFile: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.marketingSocialAd.count({ where }),
    ]);

    return buildPage(items, total, { page, limit, filters: { platform, status } });
  }

  static async findSocialAdById(tenantId: string, id: string) {
    return prisma.marketingSocialAd.findFirst({
      where: { id, tenantId },
      include: {
        product: true,
        mediaFile: true,
      },
    });
  }

  static async recordAdClick(id: string) {
    return prisma.marketingSocialAd.update({
      where: { id },
      data: { clicksCount: { increment: 1 } },
    });
  }

  static async recordAdConversion(id: string, revenue: number) {
    return prisma.marketingSocialAd.update({
      where: { id },
      data: {
        conversionsCount: { increment: 1 },
        revenueGenerated: { increment: revenue },
      },
    });
  }

  // --- Shareable Links ---
  static async createShareableLink(
    tenantId: string,
    productId: string,
    code: string,
    utmSource?: string,
    utmMedium?: string,
    utmCampaign?: string,
  ) {
    return prisma.marketingShareableLink.create({
      data: {
        tenant: { connect: { id: tenantId } },
        product: { connect: { id: productId } },
        code,
        utmSource,
        utmMedium,
        utmCampaign,
      },
      include: {
        product: true,
      },
    });
  }

  static async findShareableLinkByCode(code: string) {
    return prisma.marketingShareableLink.findUnique({
      where: { code },
      include: {
        product: true,
      },
    });
  }

  static async recordLinkClick(code: string) {
    return prisma.marketingShareableLink.update({
      where: { code },
      data: { clicks: { increment: 1 } },
    });
  }
}
