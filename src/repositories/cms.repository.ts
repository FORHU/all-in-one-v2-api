import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';

/**
 * CMS content is per-vertical: fashion and beauty each have their own
 * homepage, banners and FAQs. Every method is scoped by `tenantId`.
 */
export default class CMSRepository {
  // Page
  static async getPageBySlug(tenantId: string, slug: string) {
    return prisma.cmsPage.findUnique({
      where: { tenantId_slug: { tenantId, slug } },
      include: {
        sections: {
          orderBy: { position: 'asc' },
        },
      },
    });
  }

  static async createPage(tenantId: string, data: Omit<Prisma.CmsPageCreateInput, 'tenant'>) {
    return prisma.cmsPage.create({ data: { ...data, tenant: { connect: { id: tenantId } } } });
  }

  // Banners
  static async getActiveBanners(tenantId: string) {
    return prisma.cmsBanner.findMany({
      where: { tenantId, isActive: true },
      orderBy: { position: 'asc' },
    });
  }

  static async createBanner(tenantId: string, data: Omit<Prisma.CmsBannerCreateInput, 'tenant'>) {
    return prisma.cmsBanner.create({ data: { ...data, tenant: { connect: { id: tenantId } } } });
  }

  // Announcements
  static async getActiveAnnouncements(tenantId: string) {
    return prisma.cmsAnnouncement.findMany({
      where: { tenantId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async createAnnouncement(
    tenantId: string,
    data: Omit<Prisma.CmsAnnouncementCreateInput, 'tenant'>,
  ) {
    return prisma.cmsAnnouncement.create({ data: { ...data, tenant: { connect: { id: tenantId } } } });
  }

  // FAQs
  static async getFAQs(tenantId: string, category?: string) {
    return prisma.cmsFAQ.findMany({
      where: { tenantId, ...(category ? { category } : {}) },
      orderBy: { position: 'asc' },
    });
  }

  static async createFAQ(tenantId: string, data: Omit<Prisma.CmsFAQCreateInput, 'tenant'>) {
    return prisma.cmsFAQ.create({ data: { ...data, tenant: { connect: { id: tenantId } } } });
  }
}
