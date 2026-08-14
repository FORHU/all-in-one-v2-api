import { Prisma } from '@prisma/client';
import { prisma } from '../../utils/prisma';
import { buildPage, PageResult } from '../../helpers/pagination.helper';

type PrismaClientOrTx = typeof prisma | Prisma.TransactionClient;

/**
 * Categories belong to a single vertical. Every method takes `tenantId`
 * explicitly so the compiler flags any caller that forgets to scope.
 */
export default class CategoryRepository {
  private static readonly SORTABLE_FIELDS = new Set(['name', 'createdAt', 'updatedAt']);

  private static slugify(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .slice(0, 200);
  }

  /**
   * Maps a supplier-provided category name (CJ's `categoryName`, Printful's
   * `type_name`) onto a tenant's own CatalogCategory row — matching an
   * existing one by slug when the name lines up, auto-creating a new one
   * otherwise. `upsert` (not a separate find-then-create) so two products
   * importing the same category concurrently can't race into a duplicate
   * slug conflict.
   */
  static async findOrCreateByName(tenantId: string, name: string, client: PrismaClientOrTx = prisma) {
    const slug = this.slugify(name);
    return client.catalogCategory.upsert({
      where: { tenantId_slug: { tenantId, slug } },
      update: {},
      create: { tenantId, name, slug },
    });
  }

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
        // A true count, not a capped preview list — nothing renders the
        // products themselves on the category detail page (it links out to
        // the admin products table, filtered by this category, instead), so
        // fetching up to 20 full rows with media/variants just to read
        // `.length` was both wasteful and wrong for any category over 20.
        _count: {
          select: { products: { where: { deletedAt: null } } },
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

  static async create(
    tenantId: string,
    data: Omit<Prisma.CatalogCategoryUncheckedCreateInput, 'tenantId'>,
  ) {
    // The "Unchecked" input variant (not the relation-based CreateInput) is
    // required here: `parent` is a composite FK sharing `tenantId` with the
    // `tenant` relation, so Prisma's checked CreateInput has no plain
    // `parentId` scalar at all — passing one would throw at runtime.
    return prisma.catalogCategory.create({
      data: { ...data, tenantId },
    });
  }

  static async update(
    tenantId: string,
    id: string,
    data: Prisma.CatalogCategoryUncheckedUpdateInput,
  ) {
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
