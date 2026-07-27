import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { ProductSearchService } from '../services/product-search.service';
import { throwResponse } from '../utils/throw-response';
import { parsePagination, buildPage } from '../helpers/pagination.helper';

export const searchProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = Joi.object({
      q: Joi.string().min(1).required(),
    }).unknown(true); // Allow unknown query params like page/limit to pass through for the helper

    const { error, value } = schema.validate(req.query);

    if (error) {
      return throwResponse(400, 'Invalid search parameters', { details: error.details });
    }

    const { q } = value;
    const { page, limit } = parsePagination(req.query);

    const results = await ProductSearchService.searchAllSuppliers(q, page, limit);

    return res.status(200).json({
      status: 'success',
      statusCode: 200,
      message: 'Product search completed successfully',
      data: buildPage(results, results.length, { page, limit }),
    });
  } catch (err) {
    next(err);
  }
};
