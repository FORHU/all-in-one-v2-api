import { Request, Response, NextFunction } from 'express';
import CustomerService from './customer.service';
import { responseSuccess } from '../../helpers/response.helper';
import { parsePagination } from '../../helpers/pagination.helper';

export default class CustomerController {
  /**
   * GET /api/v2/customers
   */
  static async index(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit, search, sortBy, sortOrder } = parsePagination(
        req.query as Record<string, unknown>,
      );
      const isActive = req.query.isActive === undefined ? undefined : req.query.isActive === 'true';
      const result = await CustomerService.listCustomers(
        page,
        limit,
        search,
        sortBy,
        sortOrder,
        isActive,
      );
      return responseSuccess(res, 200, result);
    } catch (error) {
      next(error);
    }
  }
}
