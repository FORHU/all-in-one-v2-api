import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { TenantStatus, UserRole } from '@prisma/client';
import TenantService from './tenant.service';
import { responseSuccess, responseError } from '../../helpers/response.helper';
import { requireTenantId } from '../../utils/async-context';

// A slug becomes a subdomain, so it has to be a valid DNS label: lowercase
// alphanumerics and inner hyphens only.
const slugSchema = Joi.string()
  .lowercase()
  .min(2)
  .max(63)
  .pattern(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  .message('slug must be lowercase alphanumeric, optionally hyphen-separated')
  .required();

const createSchema = Joi.object({
  name: Joi.string().min(2).max(120).required(),
  slug: slugSchema,
  domain: Joi.string().hostname().optional(),
  settings: Joi.object().optional(),
});

const updateSchema = Joi.object({
  name: Joi.string().min(2).max(120).optional(),
  domain: Joi.string().hostname().optional(),
  status: Joi.string()
    .valid(...Object.values(TenantStatus))
    .optional(),
  settings: Joi.object().optional(),
}).min(1);

export default class TenantController {
  static async getTenant(req: Request, res: Response, next: NextFunction) {
    try {
      const tenant = await TenantService.getPublicTenant(req.params.slug);
      return responseSuccess(res, 200, tenant);
    } catch (error) {
      next(error);
    }
  }

  static async listTenants(_req: Request, res: Response, next: NextFunction) {
    try {
      const tenants = await TenantService.listPublicTenants();
      return responseSuccess(res, 200, tenants);
    } catch (error) {
      next(error);
    }
  }

  /** Admin view — includes suspended and deleted verticals. */
  static async listAllTenants(_req: Request, res: Response, next: NextFunction) {
    try {
      const tenants = await TenantService.listAllTenants();
      return responseSuccess(res, 200, tenants);
    } catch (error) {
      next(error);
    }
  }

  static async createTenant(req: Request, res: Response, next: NextFunction) {
    try {
      const { error, value } = createSchema.validate(req.body);
      if (error) return responseError(res, 422, error.details[0].message);

      const tenant = await TenantService.createTenant(value);
      return responseSuccess(res, 201, tenant, 'Tenant created');
    } catch (error) {
      next(error);
    }
  }

  static async updateTenant(req: Request, res: Response, next: NextFunction) {
    try {
      const { error, value } = updateSchema.validate(req.body);
      if (error) return responseError(res, 422, error.details[0].message);

      // `requirePermission` only verified tenant_settings:write against the
      // *ambient* tenant (the request's own host) — TenantRole.OWNER/ADMIN
      // hold that permission too, via a membership scoped to one tenant, so
      // without this a store's own admin could target :id = any other
      // tenant's row. Only a platform role (checked here, not membership) is
      // allowed to reach across tenants, same as /tenants/all and POST /.
      const isPlatformAdmin =
        req.user?.role === UserRole.SUPER_ADMIN || req.user?.role === UserRole.DEVELOPER;
      if (!isPlatformAdmin && req.params.id !== requireTenantId()) {
        return responseError(res, 403, "Cannot modify a different store's settings");
      }

      const tenant = await TenantService.updateTenant(req.params.id, value);
      return responseSuccess(res, 200, tenant, 'Tenant updated');
    } catch (error) {
      next(error);
    }
  }
}
