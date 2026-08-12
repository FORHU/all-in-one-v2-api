import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import ProductService from '../services/product.service';
import { responseSuccess } from '../helpers/response.helper';
import { throwResponse } from '../utils/throw-response';

const listQuerySchema = Joi.object({
  categorySlug: Joi.string().optional(),
  brand: Joi.string().optional(), // comma-separated
  color: Joi.string().optional(), // comma-separated attribute values
  size: Joi.string().optional(), // comma-separated attribute values
  priceMin: Joi.number().min(0).optional(),
  priceMax: Joi.number().min(0).optional(),
  sort: Joi.string().valid('newest', 'price-asc', 'price-desc', 'popularity').default('newest'),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

const splitCsv = (raw?: string): string[] | undefined =>
  raw
    ?.split(',')
    .map((v) => v.trim())
    .filter(Boolean);

export default class ProductController {
  static async list(req: Request, res: Response, next: NextFunction) {
    const { error, value } = listQuerySchema.validate(req.query);
    if (error) return res.status(400).json({ message: error.message });

    try {
      const result = await ProductService.listProducts({
        categorySlug: value.categorySlug,
        brands: splitCsv(value.brand),
        colorValues: splitCsv(value.color),
        sizeValues: splitCsv(value.size),
        priceMin: value.priceMin,
        priceMax: value.priceMax,
        sort: value.sort,
        page: value.page,
        limit: value.limit,
      });
      return responseSuccess(res, 200, result);
    } catch (err) {
      next(err);
    }
  }

  static async getBySlug(req: Request, res: Response, next: NextFunction) {
    try {
      const product = await ProductService.getProductBySlug(req.params.slug);
      if (!product) return throwResponse(404, `Product '${req.params.slug}' not found`);
      return responseSuccess(res, 200, product);
    } catch (err) {
      next(err);
    }
  }
}
