import { StorefrontPageType, StorefrontContextType, Prisma } from '@prisma/client';
import StorefrontRepository from './storefront.repository';
import { StorefrontBuilder } from './storefront/builder/storefront.builder';
import { StorefrontContext } from './storefront/strategies/storefront-strategy.interface';
import { StorefrontPageResult } from './storefront/dto/storefront.dto';
import { throwResponse } from '../../utils/throw-response';
import { requireTenantId } from '../../utils/async-context';

const builder = new StorefrontBuilder();

export default class StorefrontService {
  /**
   * Fetch and hydrate a StorefrontPage and all of its sections.
   */
  static async getPage(params: {
    slug?: string;
    pageType?: StorefrontPageType;
    contextType?: StorefrontContextType;
    contextId?: string;
    customerId?: string;
    locale?: string;
    currency?: string;
  }): Promise<StorefrontPageResult> {
    const tenantId = requireTenantId();

    if (!params.slug && !params.pageType) {
      throwResponse(400, 'Must provide either slug or pageType to locate the storefront page.');
    }

    const page = await StorefrontRepository.findPageWithSections({
      tenantId,
      slug: params.slug,
      pageType: params.pageType,
      contextType: params.contextType,
      contextId: params.contextId,
    });

    if (!page) {
      return throwResponse(404, 'Storefront page not found');
    }

    const context: StorefrontContext = {
      tenantId,
      page: page.slug,
      maxItems: 20, // default — overridden per section inside builder
      contextType: params.contextType,
      contextId: params.contextId,
      customerId: params.customerId,
      locale: params.locale,
      currency: params.currency,
    };

    const resolvedSections = await Promise.all(
      page.sections.map((section) =>
        builder.buildSection(section, { ...context, maxItems: section.maxItems }),
      ),
    );

    return {
      id: page.id,
      title: page.title,
      slug: page.slug,
      pageType: page.pageType,
      seoTitle: page.seoTitle,
      seoDescription: page.seoDescription,
      layout: page.layout,
      sections: resolvedSections,
    };
  }

  // ─── Admin Page Management ──────────────────────────────────────────────────

  static async createPage(data: Prisma.StorefrontPageUncheckedCreateInput) {
    data.tenantId = requireTenantId();
    return StorefrontRepository.createPage(data);
  }

  static async updatePage(id: string, data: Prisma.StorefrontPageUpdateInput) {
    const tenantId = requireTenantId();
    return StorefrontRepository.updatePage(tenantId, id, data);
  }

  static async deletePage(id: string) {
    const tenantId = requireTenantId();
    return StorefrontRepository.deletePage(tenantId, id);
  }

  // ─── Admin Section Management ────────────────────────────────────────────────

  static async getSectionById(id: string) {
    const tenantId = requireTenantId();
    const section = await StorefrontRepository.findSectionById(tenantId, id);
    if (!section) return throwResponse(404, 'Storefront section not found');
    return section;
  }

  static async createSection(data: Prisma.StorefrontSectionUncheckedCreateInput) {
    data.tenantId = requireTenantId();
    return StorefrontRepository.createSection(data);
  }

  static async updateSection(id: string, data: Prisma.StorefrontSectionUpdateInput) {
    const tenantId = requireTenantId();
    const section = await StorefrontRepository.findSectionById(tenantId, id);
    if (!section) return throwResponse(404, 'Storefront section not found');
    return StorefrontRepository.updateSection(tenantId, id, data);
  }

  static async deleteSection(id: string) {
    const tenantId = requireTenantId();
    const section = await StorefrontRepository.findSectionById(tenantId, id);
    if (!section) return throwResponse(404, 'Storefront section not found');
    return StorefrontRepository.deleteSection(tenantId, id);
  }

  static async addPinnedItem(sectionId: string, productId: string, position: number) {
    const tenantId = requireTenantId();
    const section = await StorefrontRepository.findSectionById(tenantId, sectionId);
    if (!section) return throwResponse(404, 'Storefront section not found');
    return StorefrontRepository.addPinnedItem(sectionId, productId, position);
  }

  static async removePinnedItem(sectionId: string, itemId: string) {
    const tenantId = requireTenantId();
    const section = await StorefrontRepository.findSectionById(tenantId, sectionId);
    if (!section) return throwResponse(404, 'Storefront section not found');
    return StorefrontRepository.removePinnedItem(sectionId, itemId);
  }
}
