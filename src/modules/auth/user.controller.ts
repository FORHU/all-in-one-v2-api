import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { UserRole } from '@prisma/client';
import UserService from './user.service';
import { responseSuccess, responseError } from '../../helpers/response.helper';
import { parsePagination } from '../../helpers/pagination.helper';

// Deliberately narrow — UserService.updateUser otherwise accepts a raw
// Prisma.AuthUserUpdateInput straight through, which would let this endpoint
// touch any column (including relations) rather than just what a "staff
// edit" screen means: name, role, active/inactive.
const updateUserSchema = Joi.object({
  name: Joi.string().min(1).max(120).optional(),
  role: Joi.string()
    .valid(...Object.values(UserRole))
    .optional(),
  isActive: Joi.boolean().optional(),
}).min(1);

export default class UserController {
  /**
   * GET /api/v1/users/me
   */
  static async getMe(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return responseError(res, 401, 'Unauthorized');

      const user = await UserService.getUser(userId);
      return responseSuccess(res, 200, user);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/users
   */
  static async index(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit, search, sortBy, sortOrder } = parsePagination(
        req.query as Record<string, unknown>,
      );
      const role = typeof req.query.role === 'string' ? req.query.role : undefined;
      const isActive = req.query.isActive === undefined ? undefined : req.query.isActive === 'true';
      const result = await UserService.listUsers(
        page,
        limit,
        search,
        sortBy,
        sortOrder,
        role,
        isActive,
      );
      return responseSuccess(res, 200, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/users
   */
  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const newUser = await UserService.createUser(req.body);
      return responseSuccess(res, 201, newUser, 'User created successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v2/users/:id — staff edit: name, role, active/inactive. A
   * platform admin can't deactivate their own account here — login rejects
   * `isActive: false` (auth.service.ts), so this is the same self-lockout
   * footgun as `remove` below, just reachable through a toggle instead of a
   * delete button.
   */
  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { error, value } = updateUserSchema.validate(req.body);
      if (error) return responseError(res, 422, error.details[0].message);

      if (req.params.id === req.user?.id && value.isActive === false) {
        return responseError(res, 400, 'You cannot deactivate your own account');
      }

      const updated = await UserService.updateUser(req.params.id, value);
      return responseSuccess(res, 200, updated, 'User updated successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v2/users/:id — soft delete (sets isDeleted, matching
   * UserRepository.softDelete). A platform admin can't remove their own
   * account through this endpoint — the classic self-lockout footgun.
   */
  static async remove(req: Request, res: Response, next: NextFunction) {
    try {
      if (req.params.id === req.user?.id) {
        return responseError(res, 400, 'You cannot remove your own account');
      }

      const result = await UserService.deleteUser(req.params.id);
      return responseSuccess(res, 200, result);
    } catch (error) {
      next(error);
    }
  }
}
