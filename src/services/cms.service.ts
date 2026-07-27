import CMSRepository from '../repositories/cms.repository';
import { throwResponse } from '../utils/throw-response';

export default class CMSService {
  static async getPage(slug: string) {
    const page = await CMSRepository.getPageBySlug(slug);
    if (!page) {
      return throwResponse(404, `Page '${slug}' not found`);
    }
    return page;
  }

  static async getBanners() {
    return CMSRepository.getActiveBanners();
  }

  static async getAnnouncements() {
    return CMSRepository.getActiveAnnouncements();
  }

  static async getFAQs(category?: string) {
    return CMSRepository.getFAQs(category);
  }

  static async createBanner(data: { title: string; imageUrl: string; linkUrl?: string; position?: number }) {
    return CMSRepository.createBanner(data);
  }

  static async createAnnouncement(data: { content: string; linkUrl?: string }) {
    return CMSRepository.createAnnouncement(data);
  }

  static async createFAQ(data: { question: string; answer: string; category?: string; position?: number }) {
    return CMSRepository.createFAQ(data);
  }
}
