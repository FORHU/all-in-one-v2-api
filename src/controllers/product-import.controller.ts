import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { ProductImportService } from '../services/product-import.service';
import { throwResponse } from '../utils/throw-response';

export const importProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // In a real scenario, this endpoint should be protected by an Admin middleware
    const schema = Joi.object({
      supplierId: Joi.string().required(),
      externalId: Joi.string().required(),
    });

    const { error, value } = schema.validate(req.body);

    if (error) {
      return throwResponse(400, 'Invalid import parameters', { details: error.details });
    }

    const { supplierId, externalId } = value;

    const product = await ProductImportService.importProductToPlatform(supplierId, externalId);

    return res.status(201).json({
      message: 'Product imported successfully and commission applied.',
      data: product,
    });
  } catch (err) {
    next(err);
  }
};
