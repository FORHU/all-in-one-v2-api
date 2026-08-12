import CMSRepository from './cms.repository';
import { throwResponse } from '../../utils/throw-response';
import { requireTenantId } from '../../utils/async-context';

export default class CMSService {
  static async getPage(slug: string) {
    const page = await CMSRepository.getPageBySlug(requireTenantId(), slug);
    if (!page) {
      return throwResponse(404, `Page '${slug}' not found`);
    }
    return page;
  }

  static async getBanners() {
    return CMSRepository.getActiveBanners(requireTenantId());
  }

  static async getAnnouncements() {
    return CMSRepository.getActiveAnnouncements(requireTenantId());
  }

  static async getFAQs(category?: string) {
    return CMSRepository.getFAQs(requireTenantId(), category);
  }

  static async createBanner(data: {
    title: string;
    imageUrl: string;
    linkUrl?: string;
    position?: number;
  }) {
    return CMSRepository.createBanner(requireTenantId(), data);
  }

  static async createAnnouncement(data: { content: string; linkUrl?: string }) {
    return CMSRepository.createAnnouncement(requireTenantId(), data);
  }

  static async createFAQ(data: {
    question: string;
    answer: string;
    category?: string;
    position?: number;
  }) {
    return CMSRepository.createFAQ(requireTenantId(), data);
  }
}
