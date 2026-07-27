import { Request, Response, NextFunction } from 'express';
import OrderService from '../services/order.service';
import { responseSuccess, responseError } from '../helpers/response.helper';
import { parsePagination, pageFromRepo } from '../helpers/pagination.helper';

export default class OrderController {
  static async checkout(req: Request, res: Response, next: NextFunction) {
    try {
      const customerId = req.user?.id;
      const { cartId, shippingAddressId, currency } = req.body;

      const order = await OrderService.checkoutFromCart({
        cartId,
        customerId,
        shippingAddressId,
        currency,
      });

      return responseSuccess(res, 201, order, 'Order placed successfully');
    } catch (error) {
      next(error);
    }
  }

  static async getOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const order = await OrderService.getOrderDetails(req.params.id);
      return responseSuccess(res, 200, order);
    } catch (error) {
      next(error);
    }
  }

  static async getMyOrders(req: Request, res: Response, next: NextFunction) {
    try {
      const customerId = req.user?.id;
      if (!customerId) return responseError(res, 401, 'Unauthorized');

      const { page, limit } = parsePagination(req.query as Record<string, unknown>);
      const result = await OrderService.getCustomerOrders(customerId, page, limit);

      return responseSuccess(res, 200, pageFromRepo(result));
    } catch (error) {
      next(error);
    }
  }

  static async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { status } = req.body;
      const updatedOrder = await OrderService.updateOrderStatus(req.params.id, status);
      return responseSuccess(res, 200, updatedOrder, 'Order status updated');
    } catch (error) {
      next(error);
    }
  }
}
