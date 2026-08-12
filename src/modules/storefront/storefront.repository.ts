import { StorefrontPageType, StorefrontContextType, Prisma } from '@prisma/client';
import { prisma } from '../../utils/prisma';

export interface FindPageParams {
  tenantId: string;
  slug?: string;
  pageType?: StorefrontPageType;
  contextType?: StorefrontContextType;
  contextId?: string;
}

export default class StorefrontRepository {
  /**
   * Fetches a StorefrontPage and all of its sections, filtered by the polymorphic context.
   */
  static async findPageWithSections(params: FindPageParams) {
    const { tenantId, slug, pageType, contextType, contextId } = params;

    return prisma.storefrontPage.findFirst({
      where: {
        tenantId,
        isPublished: true,
        ...(slug ? { slug } : {}),
        ...(pageType ? { pageType } : {}),
      },
      include: {
        sections: {
          where: {
            isEnabled: true,
            ...(contextType ? { contextType, contextId } : { contextType: null }),
          },
          orderBy: { sortOrder: 'asc' },
          include: {
            pinnedItems: {
              orderBy: { position: 'asc' },
              include: {
                product: {
                  include: {
                    media: { where: { isPrimary: true }, take: 1 },
                    variants: { take: 1 },
                  },
                },
              },
            },
            collection: {
              include: {
                items: {
                  orderBy: { position: 'asc' },
                  include: {
                    product: {
                      include: {
                        media: { where: { isPrimary: true }, take: 1 },
                        variants: { take: 1 },
                      },
                    },
                    productVariant: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  // ─── Pages ─────────────────────────────────────────────────────────────────

  static async createPage(data: Prisma.StorefrontPageUncheckedCreateInput) {
    return prisma.storefrontPage.create({ data });
  }

  static async updatePage(tenantId: string, id: string, data: Prisma.StorefrontPageUpdateInput) {
    await prisma.storefrontPage.updateMany({
      where: { id, tenantId },
      data: data as Prisma.StorefrontPageUncheckedUpdateManyInput,
    });
    return prisma.storefrontPage.findFirst({ where: { id, tenantId } });
  }

  static async deletePage(tenantId: string, id: string) {
    return prisma.storefrontPage.deleteMany({ where: { id, tenantId } });
  }

  // ─── Sections ──────────────────────────────────────────────────────────────

  static async findSectionById(tenantId: string, id: string) {
    return prisma.storefrontSection.findFirst({
      where: { id, tenantId },
      include: {
        pinnedItems: {
          orderBy: { position: 'asc' },
          include: { product: true },
        },
        collection: true,
      },
    });
  }

  static async createSection(data: Prisma.StorefrontSectionUncheckedCreateInput) {
    return prisma.storefrontSection.create({ data });
  }

  static async updateSection(
    tenantId: string,
    id: string,
    data: Prisma.StorefrontSectionUpdateInput,
  ) {
    await prisma.storefrontSection.updateMany({
      where: { id, tenantId },
      data: data as Prisma.StorefrontSectionUncheckedUpdateManyInput,
    });
    return this.findSectionById(tenantId, id);
  }

  static async deleteSection(tenantId: string, id: string) {
    return prisma.storefrontSection.deleteMany({ where: { id, tenantId } });
  }

  static async addPinnedItem(sectionId: string, productId: string, position: number) {
    return prisma.storefrontSectionItem.upsert({
      where: { sectionId_productId: { sectionId, productId } },
      update: { position },
      create: { sectionId, productId, position },
    });
  }

  static async removePinnedItem(sectionId: string, itemId: string) {
    return prisma.storefrontSectionItem.deleteMany({ where: { id: itemId, sectionId } });
  }
}
