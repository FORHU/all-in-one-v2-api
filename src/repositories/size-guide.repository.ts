import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';

export default class SizeGuideRepository {
  /** Find size guide by ID with entries and linked product variants */
  static async findById(id: string) {
    return prisma.catalogSizeGuide.findUnique({
      where: { id },
      include: {
        product: true,
        entries: {
          orderBy: { position: 'asc' },
          include: {
            variants: true,
          },
        },
      },
    });
  }

  /** Get all size guides for a given catalog product */
  static async findByProductId(productId: string) {
    return prisma.catalogSizeGuide.findMany({
      where: { productId },
      include: {
        entries: {
          orderBy: { position: 'asc' },
          include: {
            variants: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Create a size guide with optional initial entries */
  static async create(data: {
    productId: string;
    label: string;
    description?: string;
    unit?: string;
    entries?: Omit<Prisma.CatalogSizeEntryCreateWithoutGuideInput, 'id'>[];
  }) {
    const { entries, ...guideData } = data;
    return prisma.catalogSizeGuide.create({
      data: {
        ...guideData,
        ...(entries && entries.length > 0
          ? {
              entries: {
                create: entries,
              },
            }
          : {}),
      },
      include: {
        entries: { orderBy: { position: 'asc' } },
      },
    });
  }

  /** Update size guide details */
  static async update(id: string, data: Prisma.CatalogSizeGuideUpdateInput) {
    return prisma.catalogSizeGuide.update({
      where: { id },
      data,
      include: {
        entries: { orderBy: { position: 'asc' } },
      },
    });
  }

  /** Delete a size guide (cascade deletes entries) */
  static async delete(id: string) {
    return prisma.catalogSizeGuide.delete({ where: { id } });
  }

  // ─── Entry Operations ───────────────────────────────────────────────────────

  static async addEntry(guideId: string, data: Omit<Prisma.CatalogSizeEntryCreateInput, 'guide'>) {
    return prisma.catalogSizeEntry.create({
      data: { ...data, guide: { connect: { id: guideId } } },
    });
  }

  static async updateEntry(entryId: string, data: Prisma.CatalogSizeEntryUpdateInput) {
    return prisma.catalogSizeEntry.update({
      where: { id: entryId },
      data,
    });
  }

  static async deleteEntry(entryId: string) {
    return prisma.catalogSizeEntry.delete({ where: { id: entryId } });
  }

  /** Link a CatalogProductVariant directly to a CatalogSizeEntry */
  static async linkVariantToEntry(variantId: string, sizeEntryId: string | null) {
    return prisma.catalogProductVariant.update({
      where: { id: variantId },
      data: { sizeEntryId },
      include: { sizeEntry: true },
    });
  }
}
