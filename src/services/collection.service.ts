import CollectionRepository from '../repositories/collection.repository';
import { throwResponse } from '../utils/throw-response';
import { requireTenantId } from '../utils/async-context';
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
  static async listCollections(type?: CollectionType, categorySlug?: string) {
    const tenantId = requireTenantId();

    let categoryId: string | undefined;
    if (categorySlug) {
      const resolved = await CollectionRepository.findCategoryIdBySlug(tenantId, categorySlug);
      if (!resolved) return [];
      categoryId = resolved;
    }

    return CollectionRepository.findAllRoot(tenantId, type, categoryId);
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
  }) {
    const tenantId = requireTenantId();

    // Validate parent exists in the same tenant
    if (data.parentId) {
      const parent = await CollectionRepository.findById(tenantId, data.parentId);
      if (!parent) return throwResponse(404, 'Parent collection not found');
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
      imageUrl?: string;
      metadata?: Prisma.InputJsonValue;
      isPublic?: boolean;
      parentId?: string | null;
    },
  ) {
    const tenantId = requireTenantId();
    const collection = await CollectionRepository.findById(tenantId, id);
    if (!collection) return throwResponse(404, 'Collection not found');

    // Guard circular parent (can't set parentId to itself)
    if (data.parentId === id) return throwResponse(400, 'A collection cannot be its own parent');

    // Guard duplicate slug if slug is changing
    if (data.slug && data.slug !== collection.slug) {
      const slugTaken = await CollectionRepository.findBySlug(tenantId, data.slug);
      if (slugTaken) return throwResponse(409, `Collection slug '${data.slug}' already in use`);
    }

    return CollectionRepository.update(tenantId, id, data);
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
      slot?: string;
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
      slot?: string;
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
