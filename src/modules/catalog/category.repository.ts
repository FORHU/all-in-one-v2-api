import { Prisma } from '@prisma/client';
import { prisma } from '../../utils/prisma';
import { buildPage, PageResult } from '../../helpers/pagination.helper';

/**
 * Categories belong to a single vertical. Every method takes `tenantId`
 * explicitly so the compiler flags any caller that forgets to scope.
 */
export default class CategoryRepository {
  private static readonly SORTABLE_FIELDS = new Set(['name', 'createdAt', 'updatedAt']);

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

  static async findAllRoot(
    tenantId: string,
    page = 1,
    limit = 20,
    search?: string,
    sortBy?: string,
    sortOrder?: 'asc' | 'desc',
  ): Promise<PageResult<Prisma.CatalogCategoryGetPayload<{ include: { children: true } }>>> {
    const where: Prisma.CatalogCategoryWhereInput = {
      tenantId,
      parentId: null,
      ...(search && { name: { contains: search, mode: 'insensitive' } }),
    };

    const orderBy: Prisma.CatalogCategoryOrderByWithRelationInput =
      sortBy && this.SORTABLE_FIELDS.has(sortBy)
        ? { [sortBy]: sortOrder ?? 'asc' }
        : { name: 'asc' };

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      prisma.catalogCategory.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: { children: true },
      }),
      prisma.catalogCategory.count({ where }),
    ]);

    return buildPage(items, total, { page, limit, sortBy, sortOrder, search });
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
