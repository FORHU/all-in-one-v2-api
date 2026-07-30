import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { ProductImportService } from '../services/product-import.service';
import TenantRepository from '../repositories/tenant.repository';
import { throwResponse } from '../utils/throw-response';
import { getTenantId } from '../utils/async-context';

export const importProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = Joi.object({
      supplierId: Joi.string().required(),
      externalId: Joi.string().required(),
      // Which vertical receives the product. Optional when the request already
      // resolves to one (e.g. the admin is on fashion.example.com).
      tenantSlug: Joi.string().optional(),
    });

    const { error, value } = schema.validate(req.body);

    if (error) {
      return throwResponse(400, 'Invalid import parameters', { details: error.details });
    }

    const { supplierId, externalId, tenantSlug } = value;

    let tenantId = getTenantId();
    if (tenantSlug) {
      const tenant = await TenantRepository.findBySlug(tenantSlug);
      if (!tenant) return throwResponse(404, `Tenant '${tenantSlug}' not found`);
      tenantId = tenant.id;
    }

    if (!tenantId) {
      return throwResponse(400, 'No target tenant: pass tenantSlug or call from a storefront host');
    }

    const product = await ProductImportService.importProduct(tenantId, supplierId, externalId);

    return res.status(201).json({
      message: 'Product imported successfully and commission applied.',
      data: product,
    });
  } catch (err) {
    next(err);
  }
};
