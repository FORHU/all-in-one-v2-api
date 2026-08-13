import { Request, Response, NextFunction } from 'express';
import CategoryService from './category.service';
import { responseSuccess } from '../../helpers/response.helper';
import { parsePagination } from '../../helpers/pagination.helper';

export default class CategoryController {
  static async getRootCategories(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit, search, sortBy, sortOrder } = parsePagination(
        req.query as Record<string, unknown>,
      );
      const categories = await CategoryService.getRootCategories(
        page,
        limit,
        search,
        sortBy,
        sortOrder,
      );
      return responseSuccess(res, 200, categories);
    } catch (error) {
      next(error);
    }
  }

  static async getBySlug(req: Request, res: Response, next: NextFunction) {
    try {
      const category = await CategoryService.getCategoryBySlug(req.params.slug);
      return responseSuccess(res, 200, category);
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const category = await CategoryService.createCategory(req.body);
      return responseSuccess(res, 201, category, 'Category created successfully');
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const category = await CategoryService.updateCategory(req.params.id, req.body);
      return responseSuccess(res, 200, category, 'Category updated successfully');
    } catch (error) {
      next(error);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await CategoryService.deleteCategory(req.params.id);
      return responseSuccess(res, 200, null, 'Category deleted successfully');
    } catch (error) {
      next(error);
    }
  }
}
