import { Prisma, AdSocialPlatform, AdSocialStatus } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { buildPage, PageResult } from '../helpers/pagination.helper';

export default class MarketingRepository {
  // --- Social Feeds ---
  static async createSocialFeed(tenantId: string, data: Omit<Prisma.ProductSocialFeedCreateInput, 'tenant'>) {
    return prisma.productSocialFeed.create({
      data: {
        ...data,
        tenant: { connect: { id: tenantId } },
      },
    });
  }

  static async findSocialFeedsByTenant(tenantId: string, page = 1, limit = 20): Promise<PageResult<unknown>> {
    const skip = (page - 1) * limit;
    const where: Prisma.ProductSocialFeedWhereInput = { tenantId };

    const [items, total] = await Promise.all([
      prisma.productSocialFeed.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.productSocialFeed.count({ where }),
    ]);

    return buildPage(items, total, { page, limit });
  }

  static async findSocialFeedById(tenantId: string, id: string) {
    return prisma.productSocialFeed.findFirst({
      where: { id, tenantId },
    });
  }

  static async updateSocialFeed(tenantId: string, id: string, data: Prisma.ProductSocialFeedUpdateInput) {
    return prisma.productSocialFeed.updateMany({
      where: { id, tenantId },
      data,
    });
  }

  // --- Social Ads ---
  static async createSocialAd(tenantId: string, productId: string, data: Omit<Prisma.ProductSocialAdCreateInput, 'tenant' | 'product'>) {
    return prisma.productSocialAd.create({
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
    limit = 20
  ): Promise<PageResult<unknown>> {
    const skip = (page - 1) * limit;
    const where: Prisma.ProductSocialAdWhereInput = {
      tenantId,
      ...(platform ? { platform } : {}),
      ...(status ? { status } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.productSocialAd.findMany({
        where,
        skip,
        take: limit,
        include: {
          product: true,
          mediaFile: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.productSocialAd.count({ where }),
    ]);

    return buildPage(items, total, { page, limit, filters: { platform, status } });
  }

  static async findSocialAdById(tenantId: string, id: string) {
    return prisma.productSocialAd.findFirst({
      where: { id, tenantId },
      include: {
        product: true,
        mediaFile: true,
      },
    });
  }

  static async recordAdClick(id: string) {
    return prisma.productSocialAd.update({
      where: { id },
      data: { clicksCount: { increment: 1 } },
    });
  }

  static async recordAdConversion(id: string, revenue: number) {
    return prisma.productSocialAd.update({
      where: { id },
      data: {
        conversionsCount: { increment: 1 },
        revenueGenerated: { increment: revenue },
      },
    });
  }

  // --- Shareable Links ---
  static async createShareableLink(tenantId: string, productId: string, code: string, utmSource?: string, utmMedium?: string, utmCampaign?: string) {
    return prisma.shareableSocialLink.create({
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
    return prisma.shareableSocialLink.findUnique({
      where: { code },
      include: {
        product: true,
      },
    });
  }

  static async recordLinkClick(code: string) {
    return prisma.shareableSocialLink.update({
      where: { code },
      data: { clicks: { increment: 1 } },
    });
  }
}
