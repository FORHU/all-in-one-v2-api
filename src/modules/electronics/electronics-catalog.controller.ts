import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { ElectronicsCatalogService } from './electronics-catalog.service';
import { responseSuccess } from '../../helpers/response.helper';
import { parsePagination } from '../../helpers/pagination.helper';
import { throwResponse } from '../../utils/throw-response';

// page/limit go through parsePagination like every other paginated list;
// this schema only covers the listing's own filters.
const listQuerySchema = Joi.object({
  category: Joi.string().trim().max(120).optional().allow(''),
  sort: Joi.string().valid('newest', 'price-asc', 'price-desc', 'name-asc').default('newest'),
  priceMin: Joi.number().min(0).optional(),
  priceMax: Joi.number().min(0).optional(),
  q: Joi.string().trim().max(100).optional().allow(''), // free-text title/brand search
}).unknown(true);

export default class ElectronicsCatalogController {
  /** GET /api/v2/electronics/products?category=&sort=&priceMin=&priceMax=&q=&page=&limit= */
  static async listProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const { error, value } = listQuerySchema.validate(req.query);
      if (error) return throwResponse(400, error.message);
      if (value.priceMin != null && value.priceMax != null && value.priceMin > value.priceMax) {
        return throwResponse(400, 'priceMin cannot be greater than priceMax');
      }

      const { page, limit } = parsePagination(req.query as Record<string, unknown>, {
        limit: 12,
        maxLimit: 48,
      });

      const result = await ElectronicsCatalogService.listProducts({
        categorySlug: value.category || undefined,
        sort: value.sort,
        priceMin: value.priceMin,
        priceMax: value.priceMax,
        search: value.q || undefined,
        page,
        limit,
      });
      return responseSuccess(res, 200, result);
    } catch (err) {
      next(err);
    }
  }
}
