import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { CollectionType } from '@prisma/client';
import CollectionService from './collection.service';
import { responseSuccess } from '../../helpers/response.helper';
import { parsePagination } from '../../helpers/pagination.helper';
import { throwResponse } from '../../utils/throw-response';

const createCollectionSchema = Joi.object({
  title: Joi.string().min(1).required(),
  slug: Joi.string().min(1).required(),
  type: Joi.string()
    .valid(...Object.values(CollectionType))
    .required(),
  description: Joi.string().allow(null, '').optional(),
  imageUrl: Joi.string().allow(null, '').optional(),
  metadata: Joi.object().allow(null).optional(),
  isPublic: Joi.boolean().optional(),
  parentId: Joi.string().allow(null).optional(),
  categoryId: Joi.string().allow(null).optional(),
});

const updateCollectionSchema = Joi.object({
  title: Joi.string().min(1).optional(),
  slug: Joi.string().min(1).optional(),
  type: Joi.string()
    .valid(...Object.values(CollectionType))
    .optional(),
  description: Joi.string().allow(null, '').optional(),
  imageUrl: Joi.string().allow(null, '').optional(),
  metadata: Joi.object().allow(null).optional(),
  isPublic: Joi.boolean().optional(),
  parentId: Joi.string().allow(null).optional(),
  categoryId: Joi.string().allow(null).optional(),
}).min(1);

const addItemSchema = Joi.object({
  productId: Joi.string().required(),
  productVariantId: Joi.string().optional(),
  slot: Joi.string().allow(null, '').optional(),
  imageUrl: Joi.string().allow(null, '').optional(),
  position: Joi.number().optional(),
  isOptional: Joi.boolean().optional(),
  metadata: Joi.object().optional(),
});

const updateItemSchema = Joi.object({
  productId: Joi.string().optional(),
  productVariantId: Joi.string().allow(null).optional(),
  slot: Joi.string().allow(null, '').optional(),
  imageUrl: Joi.string().allow(null, '').optional(),
  position: Joi.number().optional(),
  isOptional: Joi.boolean().optional(),
  metadata: Joi.object().optional(),
}).min(1);

const reorderItemsSchema = Joi.object({
  items: Joi.array()
    .items(
      Joi.object({
        id: Joi.string().required(),
        position: Joi.number().required(),
      }),
    )
    .min(1)
    .required(),
});

export default class CollectionController {
  // ─── Collections ────────────────────────────────────────────────────────────

  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit, search, sortBy, sortOrder } = parsePagination(
        req.query as Record<string, unknown>,
      );
      const type = req.query.type as CollectionType | undefined;
      const categorySlug = req.query.categorySlug as string | undefined;
      // optionalAuthenticate populates req.user for the admin panel's
      // authenticated requests (it always sends a Bearer token when logged
      // in) but leaves it unset for anonymous storefront visitors — only the
      // latter should have unpublished collections filtered out.
      const collections = await CollectionService.listCollections(
        page,
        limit,
        search,
        sortBy,
        sortOrder,
        type,
        categorySlug,
        Boolean(req.user),
      );
      return responseSuccess(res, 200, collections);
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const collection = await CollectionService.getCollectionById(
        req.params.id,
        Boolean(req.user),
      );
      return responseSuccess(res, 200, collection);
    } catch (error) {
      next(error);
    }
  }

  static async getBySlug(req: Request, res: Response, next: NextFunction) {
    try {
      const collection = await CollectionService.getCollectionBySlug(
        req.params.slug,
        Boolean(req.user),
      );
      return responseSuccess(res, 200, collection);
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { error, value } = createCollectionSchema.validate(req.body);
      if (error) return throwResponse(400, 'Invalid collection data', { details: error.details });

      const collection = await CollectionService.createCollection(value);
      return responseSuccess(res, 201, collection, 'Collection created successfully');
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { error, value } = updateCollectionSchema.validate(req.body);
      if (error) return throwResponse(400, 'Invalid collection data', { details: error.details });

      const collection = await CollectionService.updateCollection(req.params.id, value);
      return responseSuccess(res, 200, collection, 'Collection updated successfully');
    } catch (error) {
      next(error);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await CollectionService.deleteCollection(req.params.id);
      return responseSuccess(res, 200, null, 'Collection deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  // ─── Collection Items ────────────────────────────────────────────────────────

  static async addItem(req: Request, res: Response, next: NextFunction) {
    try {
      const { error, value } = addItemSchema.validate(req.body);
      if (error)
        return throwResponse(400, 'Invalid collection item data', { details: error.details });

      const item = await CollectionService.addItem(req.params.collectionId, value);
      return responseSuccess(res, 201, item, 'Collection item added successfully');
    } catch (error) {
      next(error);
    }
  }

  static async updateItem(req: Request, res: Response, next: NextFunction) {
    try {
      const { error, value } = updateItemSchema.validate(req.body);
      if (error)
        return throwResponse(400, 'Invalid collection item data', { details: error.details });

      const item = await CollectionService.updateItem(
        req.params.collectionId,
        req.params.itemId,
        value,
      );
      return responseSuccess(res, 200, item, 'Collection item updated successfully');
    } catch (error) {
      next(error);
    }
  }

  static async removeItem(req: Request, res: Response, next: NextFunction) {
    try {
      await CollectionService.removeItem(req.params.collectionId, req.params.itemId);
      return responseSuccess(res, 200, null, 'Collection item removed successfully');
    } catch (error) {
      next(error);
    }
  }

  static async reorderItems(req: Request, res: Response, next: NextFunction) {
    try {
      const { error, value } = reorderItemsSchema.validate(req.body);
      if (error) return throwResponse(400, 'Invalid reorder data', { details: error.details });

      const result = await CollectionService.reorderItems(req.params.collectionId, value.items);
      return responseSuccess(res, 200, result, 'Collection items reordered successfully');
    } catch (error) {
      next(error);
    }
  }
}
