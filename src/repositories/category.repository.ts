import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';

/**
 * Categories belong to a single vertical. Every method takes `tenantId`
 * explicitly so the compiler flags any caller that forgets to scope.
 */
export default class CategoryRepository {
  static async findById(tenantId: string, id: string) {
    return prisma.catalogCategory.findFirst({
      where: { id, tenantId },
      include: {
        parent: true,
        children: true,
      },
    });
  }

  static async findBySlug(tenantId: string, slug: string) {
    return prisma.catalogCategory.findUnique({
      where: { tenantId_slug: { tenantId, slug } },
      include: {
        parent: true,
        children: true,
        products: {
          take: 20,
          include: {
            media: true,
            variants: true,
          },
        },
      },
    });
  }

  static async findAllRoot(tenantId: string) {
    return prisma.catalogCategory.findMany({
      where: { tenantId, parentId: null },
      include: {
        children: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  static async create(tenantId: string, data: Omit<Prisma.CatalogCategoryCreateInput, 'tenant'>) {
    return prisma.catalogCategory.create({
      data: { ...data, tenant: { connect: { id: tenantId } } },
    });
  }

  static async update(tenantId: string, id: string, data: Prisma.CatalogCategoryUpdateInput) {
    // updateMany rather than update: it accepts a non-unique where clause, so
    // the tenant filter is enforced by the database rather than assumed.
    await prisma.catalogCategory.updateMany({ where: { id, tenantId }, data });
    return this.findById(tenantId, id);
  }

  static async delete(tenantId: string, id: string) {
    return prisma.catalogCategory.deleteMany({
      where: { id, tenantId },
    });
  }
}
