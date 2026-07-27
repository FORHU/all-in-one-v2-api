import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';

export default class CMSRepository {
  // Page
  static async getPageBySlug(slug: string) {
    return prisma.page.findUnique({
      where: { slug },
      include: {
        sections: {
          orderBy: { position: 'asc' },
        },
      },
    });
  }

  static async createPage(data: Prisma.PageCreateInput) {
    return prisma.page.create({ data });
  }

  // Banners
  static async getActiveBanners() {
    return prisma.banner.findMany({
      where: { isActive: true },
      orderBy: { position: 'asc' },
    });
  }

  static async createBanner(data: Prisma.BannerCreateInput) {
    return prisma.banner.create({ data });
  }

  // Announcements
  static async getActiveAnnouncements() {
    return prisma.announcement.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async createAnnouncement(data: Prisma.AnnouncementCreateInput) {
    return prisma.announcement.create({ data });
  }

  // FAQs
  static async getFAQs(category?: string) {
    return prisma.fAQ.findMany({
      where: category ? { category } : undefined,
      orderBy: { position: 'asc' },
    });
  }

  static async createFAQ(data: Prisma.FAQCreateInput) {
    return prisma.fAQ.create({ data });
  }
}
