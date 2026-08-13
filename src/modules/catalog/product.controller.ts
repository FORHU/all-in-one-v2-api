import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { ProductStatus } from '@prisma/client';
import ProductService from './product.service';
import { responseSuccess, responseError } from '../../helpers/response.helper';
import { parsePagination } from '../../helpers/pagination.helper';

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

  /**
   * GET /api/v2/products/admin
   * Admin product management listing — every status, no auth-less public access.
   */
  static async adminList(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit, search, sortBy, sortOrder } = parsePagination(
        req.query as Record<string, unknown>,
      );
      const status = Object.values(ProductStatus).includes(req.query.status as ProductStatus)
        ? (req.query.status as ProductStatus)
        : undefined;
      const categoryId =
        typeof req.query.categoryId === 'string' ? req.query.categoryId : undefined;
      const brand = typeof req.query.brand === 'string' ? req.query.brand : undefined;

      const result = await ProductService.listProductsForAdmin(
        page,
        limit,
        search,
        sortBy,
        sortOrder,
        status,
        categoryId,
        brand,
      );
      return responseSuccess(res, 200, result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v2/products/brands — distinct brand values in use, with
   * per-brand product counts. Backs the admin Brands page.
   */
  static async getBrands(req: Request, res: Response, next: NextFunction) {
    try {
      const brands = await ProductService.getBrandCounts();
      return responseSuccess(res, 200, { items: brands });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/v2/products/brands/:brand — bulk rename (`newBrand: "X"`) or
   * clear (`newBrand: null`) a brand across every product carrying it.
   */
  static async renameBrand(req: Request, res: Response, next: NextFunction) {
    try {
      const newBrand = typeof req.body.newBrand === 'string' ? req.body.newBrand : null;
      const result = await ProductService.renameBrand(req.params.brand, newBrand);
      return responseSuccess(res, 200, result, 'Brand updated successfully');
    } catch (err) {
      next(err);
    }
  }

  static async getBySlug(req: Request, res: Response, next: NextFunction) {
    try {
      const product = await ProductService.getProductBySlug(req.params.slug);
      if (!product) return responseError(res, 404, `Product '${req.params.slug}' not found`);
      return responseSuccess(res, 200, product);
    } catch (err) {
      next(err);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const product = await ProductService.createProduct(req.body);
      return responseSuccess(res, 201, product, 'Product created successfully');
    } catch (err) {
      next(err);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const product = await ProductService.updateProduct(req.params.id, req.body);
      return responseSuccess(res, 200, product, 'Product updated successfully');
    } catch (err) {
      next(err);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await ProductService.deleteProduct(req.params.id);
      return responseSuccess(res, 200, null, 'Product deleted successfully');
    } catch (err) {
      next(err);
    }
  }
}
