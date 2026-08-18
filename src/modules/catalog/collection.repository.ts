import { Prisma, CollectionType } from '@prisma/client';
import { prisma } from '../../utils/prisma';
import { buildPage, PageResult } from '../../helpers/pagination.helper';

/**
 * CatalogCollection repository — scoped to tenantId on every query.
 * Supports hierarchical nesting (parentId self-relation) and
 * collection items linked to CatalogProduct.
 */

// Reusable include shape for a collection with its full tree
const collectionWithItems = {
  items: {
    orderBy: { position: 'asc' as const },
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
  children: {
    include: {
      items: {
        orderBy: { position: 'asc' as const },
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
} satisfies Prisma.CatalogCollectionInclude;

export default class CollectionRepository {
  // ─── Collections ────────────────────────────────────────────────────────────

  private static readonly SORTABLE_FIELDS = new Set(['title', 'createdAt', 'updatedAt']);

  /** Paginated top-level collections for a tenant (parentId = null). */
  static async findAllRoot(
    tenantId: string,
    page = 1,
    limit = 20,
    search?: string,
    sortBy?: string,
    sortOrder?: 'asc' | 'desc',
    type?: CollectionType,
    categoryId?: string,
  ): Promise<
    PageResult<Prisma.CatalogCollectionGetPayload<{ include: typeof collectionWithItems }>>
  > {
    const where: Prisma.CatalogCollectionWhereInput = {
      tenantId,
      parentId: null,
      isDeleted: false,
      ...(type ? { type } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(search && { title: { contains: search, mode: 'insensitive' } }),
    };

    const orderBy: Prisma.CatalogCollectionOrderByWithRelationInput =
      sortBy && this.SORTABLE_FIELDS.has(sortBy)
        ? { [sortBy]: sortOrder ?? 'asc' }
        : { createdAt: 'desc' };

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      prisma.catalogCollection.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: collectionWithItems,
      }),
      prisma.catalogCollection.count({ where }),
    ]);

    return buildPage(items, total, { page, limit, sortBy, sortOrder, search });
  }

  static async findCategoryIdBySlug(tenantId: string, slug: string): Promise<string | null> {
    const category = await prisma.catalogCategory.findUnique({
      where: { tenantId_slug: { tenantId, slug } },
      select: { id: true },
    });
    return category?.id ?? null;
  }

  static async findById(tenantId: string, id: string) {
    return prisma.catalogCollection.findFirst({
      where: { id, tenantId, isDeleted: false },
      include: {
        parent: true,
        ...collectionWithItems,
      },
    });
  }

  static async findBySlug(tenantId: string, slug: string) {
    return prisma.catalogCollection.findFirst({
      where: { tenantId, slug, isDeleted: false },
      include: {
        parent: true,
        ...collectionWithItems,
      },
    });
  }

  static async create(
    tenantId: string,
    data: {
      title: string;
      slug: string;
      type: CollectionType;
      description?: string;
      imageUrl?: string;
      metadata?: Prisma.InputJsonValue;
      isPublic?: boolean;
      parentId?: string;
      categoryId?: string | null;
    },
  ) {
    const { parentId, categoryId, ...rest } = data;
    return prisma.catalogCollection.create({
      data: {
        ...rest,
        tenant: { connect: { id: tenantId } },
        ...(parentId ? { parent: { connect: { id: parentId } } } : {}),
        ...(categoryId
          ? { category: { connect: { tenantId_id: { tenantId, id: categoryId } } } }
          : {}),
      },
      include: collectionWithItems,
    });
  }

  static async update(tenantId: string, id: string, data: Prisma.CatalogCollectionUpdateInput) {
    await prisma.catalogCollection.updateMany({ where: { id, tenantId }, data });
    return this.findById(tenantId, id);
  }

  /** Soft-delete: sets isDeleted = true rather than hard-deleting. */
  static async softDelete(tenantId: string, id: string) {
    return prisma.catalogCollection.updateMany({
      where: { id, tenantId },
      data: { isDeleted: true },
    });
  }

  // ─── Collection Items ────────────────────────────────────────────────────────

  static async addItem(
    collectionId: string,
    data: {
      productId: string;
      productVariantId?: string;
      slot?: string | null;
      imageUrl?: string;
      position?: number;
      isOptional?: boolean;
      metadata?: Prisma.InputJsonValue;
    },
  ) {
    return prisma.catalogCollectionItem.create({
      data: { collectionId, ...data },
      include: {
        product: { include: { media: { where: { isPrimary: true }, take: 1 } } },
        productVariant: true,
      },
    });
  }

  static async updateItem(itemId: string, data: Prisma.CatalogCollectionItemUpdateInput) {
    return prisma.catalogCollectionItem.update({
      where: { id: itemId },
      data,
      include: {
        product: { include: { media: { where: { isPrimary: true }, take: 1 } } },
        productVariant: true,
      },
    });
  }

  // deleteMany (not delete) so removing an item that's already gone — e.g. a
  // double-click firing two requests before the UI disables the button — is
  // a harmless no-op instead of a P2025 "record to delete does not exist"
  // throw. DELETE is supposed to be idempotent.
  static async removeItem(itemId: string) {
    return prisma.catalogCollectionItem.deleteMany({ where: { id: itemId } });
  }

  /** Reorder items in bulk — accepts array of { id, position } pairs. */
  static async reorderItems(updates: { id: string; position: number }[]) {
    return prisma.$transaction(
      updates.map(({ id, position }) =>
        prisma.catalogCollectionItem.update({ where: { id }, data: { position } }),
      ),
    );
  }
}
