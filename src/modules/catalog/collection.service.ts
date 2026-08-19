import CollectionRepository from './collection.repository';
import CategoryRepository from './category.repository';
import { throwResponse } from '../../utils/throw-response';
import { requireTenantId } from '../../utils/async-context';
import { deleteFromS3 } from '../../utils/s3.util';
import logger from '../../utils/logger';
import { Prisma, CollectionType } from '@prisma/client';

export default class CollectionService {
  // ─── Collections ────────────────────────────────────────────────────────────

  /**
   * All top-level collections (parentId = null). Optionally filter by type
   * and/or by the category page they're featured under (e.g. "Shop the
   * Look" on the Women page only shows looks tagged to womens-fashion). An
   * unknown categorySlug intentionally narrows to zero results rather than
   * silently falling back to "show everything" — same convention as
   * ProductService.listProducts.
   */
  static async listCollections(
    page?: number,
    limit?: number,
    search?: string,
    sortBy?: string,
    sortOrder?: 'asc' | 'desc',
    type?: CollectionType,
    categorySlug?: string,
  ) {
    const tenantId = requireTenantId();

    let categoryId: string | undefined;
    if (categorySlug) {
      const resolved = await CollectionRepository.findCategoryIdBySlug(tenantId, categorySlug);
      if (!resolved) {
        return { items: [], total: 0, page: page ?? 1, limit: limit ?? 20, totalPages: 0 };
      }
      categoryId = resolved;
    }

    return CollectionRepository.findAllRoot(
      tenantId,
      page,
      limit,
      search,
      sortBy,
      sortOrder,
      type,
      categoryId,
    );
  }

  static async getCollectionById(id: string) {
    const collection = await CollectionRepository.findById(requireTenantId(), id);
    if (!collection) return throwResponse(404, 'Collection not found');
    return collection;
  }

  static async getCollectionBySlug(slug: string) {
    const collection = await CollectionRepository.findBySlug(requireTenantId(), slug);
    if (!collection) return throwResponse(404, `Collection '${slug}' not found`);
    return collection;
  }

  static async createCollection(data: {
    title: string;
    slug: string;
    type: CollectionType;
    description?: string;
    imageUrl?: string;
    metadata?: Prisma.InputJsonValue;
    isPublic?: boolean;
    parentId?: string;
    categoryId?: string | null;
  }) {
    const tenantId = requireTenantId();

    // Validate parent exists in the same tenant
    if (data.parentId) {
      const parent = await CollectionRepository.findById(tenantId, data.parentId);
      if (!parent) return throwResponse(404, 'Parent collection not found');
    }

    // Validate category exists in the same tenant
    if (data.categoryId) {
      const category = await CategoryRepository.findById(tenantId, data.categoryId);
      if (!category) return throwResponse(404, 'Category not found');
    }

    // Guard duplicate slug
    const existing = await CollectionRepository.findBySlug(tenantId, data.slug);
    if (existing) return throwResponse(409, `Collection slug '${data.slug}' already in use`);

    return CollectionRepository.create(tenantId, data);
  }

  static async updateCollection(
    id: string,
    data: {
      title?: string;
      slug?: string;
      type?: CollectionType;
      description?: string;
      imageUrl?: string | null;
      metadata?: Prisma.InputJsonValue;
      isPublic?: boolean;
      parentId?: string | null;
      categoryId?: string | null;
    },
  ) {
    const tenantId = requireTenantId();
    const collection = await CollectionRepository.findById(tenantId, id);
    if (!collection) return throwResponse(404, 'Collection not found');

    if (data.parentId) {
      // Guard circular parent (can't set parentId to itself)
      if (data.parentId === id) return throwResponse(400, 'A collection cannot be its own parent');

      const parent = await CollectionRepository.findById(tenantId, data.parentId);
      if (!parent) return throwResponse(404, 'Parent collection not found');

      // Nesting only ever goes one level deep — CollectionRepository's
      // `collectionWithItems` include only eager-loads `children`, not
      // grandchildren, and the create-side form only offers top-level
      // collections as parents (see CollectionFormModal). Enforce both
      // directions server-side so that assumption can't be bypassed via the
      // API directly:
      if (parent.parentId) {
        // ...the new parent can't itself already be nested...
        return throwResponse(
          400,
          'Parent collection must be top-level — cannot nest three levels deep',
        );
      }
      if (collection.children.length > 0) {
        // ...and this collection can't already have children, or they'd
        // become invisible grandchildren of the new parent the moment it's
        // re-parented (nothing deletes them — they just stop being fetched).
        return throwResponse(
          400,
          'Cannot nest a collection that already has its own children — remove or re-parent them first',
        );
      }
    }

    // Validate category exists in the same tenant
    if (data.categoryId) {
      const category = await CategoryRepository.findById(tenantId, data.categoryId);
      if (!category) return throwResponse(404, 'Category not found');
    }

    // Guard duplicate slug if slug is changing
    if (data.slug && data.slug !== collection.slug) {
      const slugTaken = await CollectionRepository.findBySlug(tenantId, data.slug);
      if (slugTaken) return throwResponse(409, `Collection slug '${data.slug}' already in use`);
    }

    const previousImageUrl = collection.imageUrl;
    const updated = await CollectionRepository.update(tenantId, id, data);

    // Replacing (or clearing) the cover image orphans the old S3 object —
    // clean it up now that the new value is confirmed saved. Best-effort:
    // this must never fail the update response itself, and it silently
    // no-ops on a pasted external URL we never uploaded.
    if (data.imageUrl !== undefined && data.imageUrl !== previousImageUrl && previousImageUrl) {
      deleteFromS3(previousImageUrl).catch((err) => {
        logger.warn(`Failed to delete replaced collection image from S3: ${err.message}`);
      });
    }

    return updated;
  }

  static async deleteCollection(id: string) {
    const tenantId = requireTenantId();
    const collection = await CollectionRepository.findById(tenantId, id);
    if (!collection) return throwResponse(404, 'Collection not found');
    return CollectionRepository.softDelete(tenantId, id);
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
    // Verify collection belongs to this tenant
    const collection = await CollectionRepository.findById(requireTenantId(), collectionId);
    if (!collection) return throwResponse(404, 'Collection not found');

    return CollectionRepository.addItem(collectionId, data);
  }

  static async updateItem(
    collectionId: string,
    itemId: string,
    data: {
      productId?: string;
      productVariantId?: string | null;
      slot?: string | null;
      imageUrl?: string | null;
      position?: number;
      isOptional?: boolean;
      metadata?: Prisma.InputJsonValue;
    },
  ) {
    const collection = await CollectionRepository.findById(requireTenantId(), collectionId);
    if (!collection) return throwResponse(404, 'Collection not found');

    return CollectionRepository.updateItem(itemId, data);
  }

  static async removeItem(collectionId: string, itemId: string) {
    const collection = await CollectionRepository.findById(requireTenantId(), collectionId);
    if (!collection) return throwResponse(404, 'Collection not found');

    return CollectionRepository.removeItem(itemId);
  }

  /** Bulk reorder items — accepts [{ id, position }] */
  static async reorderItems(collectionId: string, updates: { id: string; position: number }[]) {
    const collection = await CollectionRepository.findById(requireTenantId(), collectionId);
    if (!collection) return throwResponse(404, 'Collection not found');

    return CollectionRepository.reorderItems(updates);
  }
}
