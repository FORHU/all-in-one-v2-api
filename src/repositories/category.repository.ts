import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';

/**
 * Categories belong to a single vertical. Every method takes `tenantId`
 * explicitly so the compiler flags any caller that forgets to scope.
 */
export default class CategoryRepository {
  static async findById(tenantId: string, id: string) {
    return prisma.category.findFirst({
      where: { id, tenantId },
      include: {
        parent: true,
        children: true,
      },
    });
  }

  static async findBySlug(tenantId: string, slug: string) {
    return prisma.category.findUnique({
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
    return prisma.category.findMany({
      where: { tenantId, parentId: null },
      include: {
        children: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  static async create(tenantId: string, data: Omit<Prisma.CategoryCreateInput, 'tenant'>) {
    return prisma.category.create({
      data: { ...data, tenant: { connect: { id: tenantId } } },
    });
  }

  static async update(tenantId: string, id: string, data: Prisma.CategoryUpdateInput) {
    // updateMany rather than update: it accepts a non-unique where clause, so
    // the tenant filter is enforced by the database rather than assumed.
    await prisma.category.updateMany({ where: { id, tenantId }, data });
    return this.findById(tenantId, id);
  }

  static async delete(tenantId: string, id: string) {
    return prisma.category.deleteMany({
      where: { id, tenantId },
    });
  }
}
