import { Request, Response, NextFunction } from 'express';
import UserService from '../services/user.service';
import { responseSuccess, responseError } from '../helpers/response.helper';
import { parsePagination } from '../helpers/pagination.helper';

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
      const result = await UserService.listUsers(page, limit, search, sortBy, sortOrder);
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
}
