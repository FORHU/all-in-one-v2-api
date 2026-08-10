import { Request, Response, NextFunction } from 'express';
import { CollectionType } from '@prisma/client';
import CollectionService from '../services/collection.service';
import { responseSuccess } from '../helpers/response.helper';

export default class CollectionController {
  // ─── Collections ────────────────────────────────────────────────────────────

  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const type = req.query.type as CollectionType | undefined;
      const categorySlug = req.query.categorySlug as string | undefined;
      const collections = await CollectionService.listCollections(type, categorySlug);
      return responseSuccess(res, 200, collections);
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const collection = await CollectionService.getCollectionById(req.params.id);
      return responseSuccess(res, 200, collection);
    } catch (error) {
      next(error);
    }
  }

  static async getBySlug(req: Request, res: Response, next: NextFunction) {
    try {
      const collection = await CollectionService.getCollectionBySlug(req.params.slug);
      return responseSuccess(res, 200, collection);
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const collection = await CollectionService.createCollection(req.body);
      return responseSuccess(res, 201, collection, 'Collection created successfully');
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const collection = await CollectionService.updateCollection(req.params.id, req.body);
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
      const item = await CollectionService.addItem(req.params.collectionId, req.body);
      return responseSuccess(res, 201, item, 'Collection item added successfully');
    } catch (error) {
      next(error);
    }
  }

  static async updateItem(req: Request, res: Response, next: NextFunction) {
    try {
      const item = await CollectionService.updateItem(
        req.params.collectionId,
        req.params.itemId,
        req.body,
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
      const result = await CollectionService.reorderItems(req.params.collectionId, req.body.items);
      return responseSuccess(res, 200, result, 'Collection items reordered successfully');
    } catch (error) {
      next(error);
    }
  }
}
