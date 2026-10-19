import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { ElectronicsSourcingService } from './electronics-sourcing.service';
import { ELECTRONICS_CATEGORY_SLUGS } from './electronics.config';
import { responseSuccess } from '../../helpers/response.helper';
import { throwResponse } from '../../utils/throw-response';

const categorySlug = Joi.string()
  .valid(...ELECTRONICS_CATEGORY_SLUGS)
  .required();

const searchQuerySchema = Joi.object({
  category: categorySlug,
  q: Joi.string().trim().max(200).optional().allow(''),
  cjCategoryId: Joi.string().optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(20),
});

const importBodySchema = Joi.object({
  externalId: Joi.string().required(),
  categorySlug,
});

export default class ElectronicsSourcingController {
  /** GET /api/v2/electronics/cj/categories */
  static async categories(_req: Request, res: Response, next: NextFunction) {
    try {
      const categories = await ElectronicsSourcingService.getCategoryMap();
      return responseSuccess(res, 200, categories);
    } catch (err) {
      next(err);
    }
  }

  /** GET /api/v2/electronics/cj/search?category=audio&q=&cjCategoryId=&page=&limit= */
  static async search(req: Request, res: Response, next: NextFunction) {
    try {
      const { error, value } = searchQuerySchema.validate(req.query);
      if (error) return throwResponse(400, error.message);

      const result = await ElectronicsSourcingService.searchCj({
        categorySlug: value.category,
        q: value.q,
        cjCategoryId: value.cjCategoryId,
        page: value.page,
        limit: value.limit,
      });
      return responseSuccess(res, 200, result);
    } catch (err) {
      next(err);
    }
  }

  /** POST /api/v2/electronics/cj/import { externalId, categorySlug } */
  static async import(req: Request, res: Response, next: NextFunction) {
    try {
      const { error, value } = importBodySchema.validate(req.body);
      if (error) return throwResponse(400, error.message);

      const product = await ElectronicsSourcingService.importFromCj(
        value.externalId,
        value.categorySlug,
      );
      return responseSuccess(res, 201, product, 'Product imported from CJ Dropshipping');
    } catch (err) {
      next(err);
    }
  }
}
