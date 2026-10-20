import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { TenantRole, TenantStatus, UserRole } from '@prisma/client';
import MembershipService from './membership.service';
import MembershipRepository from './membership.repository';
import TenantRepository from './tenant.repository';
import { responseSuccess, responseError } from '../../helpers/response.helper';
import { requireTenantId } from '../../utils/async-context';

const grantSchema = Joi.object({
  // Normalized to lowercase so "Admin@X.com" and "admin@x.com" are always
  // treated as the same account, both for the existing-account lookup and
  // for a brand-new account created by this endpoint.
  email: Joi.string().email().lowercase().required(),
  role: Joi.string()
    .valid(...Object.values(TenantRole))
    .required(),
  // Only honored when the caller is a platform admin (see create() below) —
  // lets them grant into a store other than whichever one is ambient, or
  // into a store at all while in Platform scope (no x-tenant-slug sent),
  // where requireTenantId() would otherwise throw 400.
  tenantId: Joi.string().uuid().optional(),
  // Only used when `email` doesn't match an existing account — creates one
  // on the spot instead of 404ing. Both or neither: a name with no password
  // (or vice versa) is a client bug, not a valid partial request.
  name: Joi.string().min(1).max(120).optional(),
  password: Joi.string().min(6).optional(),
}).and('name', 'password');

const updateRoleSchema = Joi.object({
  role: Joi.string()
    .valid(...Object.values(TenantRole))
    .required(),
});

const isPlatformAdmin = (req: Request): boolean =>
  req.user?.role === UserRole.SUPER_ADMIN || req.user?.role === UserRole.DEVELOPER;

/**
 * Resolves the role the caller acts with for this tenant. A platform admin
 * (SUPER_ADMIN/DEVELOPER) has no membership row of their own — `requirePermission`
 * already let them through via `platform:manage`, so they're treated as an
 * OWNER-equivalent ceiling, same as `requireTenantRole`'s platform-admin bypass.
 */
const resolveActingRole = async (req: Request): Promise<TenantRole> => {
  if (isPlatformAdmin(req)) return TenantRole.OWNER;

  const membership = await TenantRepository.getMembership(requireTenantId(), req.user!.id);
  // A SUSPENDED/INVITED row must never act with its role's power — status is
  // otherwise stored and never enforced anywhere in this codebase.
  if (!membership || membership.status !== 'ACTIVE') {
    throw { status: 403, message: 'No active membership in this store' };
  }
  return membership.role;
};

export default class MembershipController {
  static async index(_req: Request, res: Response, next: NextFunction) {
    try {
      const members = await MembershipService.listMembers(requireTenantId());
      return responseSuccess(res, 200, members);
    } catch (error) {
      next(error);
    }
  }

  /** GET /tenant-memberships/mine — every tenant the caller belongs to, independent of ambient tenant context. */
  static async mine(req: Request, res: Response, next: NextFunction) {
    try {
      const memberships = await MembershipService.listMyMemberships(req.user!.id);
      return responseSuccess(res, 200, memberships);
    } catch (error) {
      next(error);
    }
  }

  /** GET /tenant-memberships/all — platform-admin-only, every store's roster at once. */
  static async all(_req: Request, res: Response, next: NextFunction) {
    try {
      const memberships = await MembershipService.listAllMemberships();
      return responseSuccess(res, 200, memberships);
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { error, value } = grantSchema.validate(req.body);
      if (error) return responseError(res, 422, error.details[0].message);

      if (value.tenantId && !isPlatformAdmin(req)) {
        return responseError(res, 403, 'Only a platform admin may target another store');
      }

      let targetTenantId: string;
      if (value.tenantId) {
        const tenant = await TenantRepository.findById(value.tenantId);
        if (!tenant) return responseError(res, 404, 'Tenant not found');
        // The ambient path (no explicit tenantId) already gets this for free
        // — resolveTenant rejects any request scoped to a non-ACTIVE tenant
        // before it ever reaches here. A platform admin's explicit tenantId
        // bypasses that middleware entirely, so it needs its own check.
        if (tenant.status !== TenantStatus.ACTIVE) {
          return responseError(
            res,
            422,
            `Cannot grant access to a ${tenant.status.toLowerCase()} store`,
          );
        }
        targetTenantId = value.tenantId;
      } else {
        targetTenantId = requireTenantId();
      }

      const actingRole = await resolveActingRole(req);
      const membership = await MembershipService.grant(
        targetTenantId,
        req.user!.id,
        actingRole,
        value.email,
        value.role,
        value.name && value.password ? { name: value.name, password: value.password } : undefined,
      );
      return responseSuccess(res, 201, membership, 'Membership granted');
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { error, value } = updateRoleSchema.validate(req.body);
      if (error) return responseError(res, 422, error.details[0].message);

      const actingRole = await resolveActingRole(req);

      let targetTenantId: string;
      if (isPlatformAdmin(req)) {
        const existing = await MembershipRepository.findByIdUnscoped(req.params.id);
        if (!existing) return responseError(res, 404, 'Membership not found');
        targetTenantId = existing.tenantId;
      } else {
        targetTenantId = requireTenantId();
      }

      const membership = await MembershipService.updateRole(
        targetTenantId,
        req.user!.id,
        actingRole,
        req.params.id,
        value.role,
      );
      return responseSuccess(res, 200, membership, 'Membership updated');
    } catch (error) {
      next(error);
    }
  }

  static async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const actingRole = await resolveActingRole(req);

      let targetTenantId: string;
      if (isPlatformAdmin(req)) {
        const existing = await MembershipRepository.findByIdUnscoped(req.params.id);
        if (!existing) return responseError(res, 404, 'Membership not found');
        targetTenantId = existing.tenantId;
      } else {
        targetTenantId = requireTenantId();
      }

      const result = await MembershipService.remove(
        targetTenantId,
        req.user!.id,
        actingRole,
        req.params.id,
      );
      return responseSuccess(res, 200, result);
    } catch (error) {
      next(error);
    }
  }
}
