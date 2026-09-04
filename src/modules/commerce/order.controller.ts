import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { OrderStatus } from '@prisma/client';
import OrderService from './order.service';
import { responseSuccess, responseError } from '../../helpers/response.helper';
import { parsePagination, pageFromRepo } from '../../helpers/pagination.helper';
import { resolveCustomerId, resolveOrderViewer } from '../../helpers/requester.helper';

const checkoutDirectSchema = Joi.object({
  items: Joi.array()
    .items(
      Joi.object({
        productId: Joi.string().required(),
        size: Joi.string().optional(),
        color: Joi.string().optional(),
        quantity: Joi.number().integer().min(1).required(),
      }),
    )
    .min(1)
    .required(),
  shippingAddressId: Joi.string().optional(),
  couponCode: Joi.string().trim().optional(),
  promotionCode: Joi.string().trim().optional(),
  currency: Joi.string().optional(),
});

const checkoutSchema = Joi.object({
  shippingAddressId: Joi.string().optional(),
  couponCode: Joi.string().trim().optional(),
  promotionCode: Joi.string().trim().optional(),
  currency: Joi.string().optional(),
});

export default class OrderController {
  /**
   * GET /api/v2/orders
   */
  static async index(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit, search, sortBy, sortOrder } = parsePagination(
        req.query as Record<string, unknown>,
      );
      const rawStatus = req.query.status as string | undefined;
      const status =
        rawStatus && (Object.values(OrderStatus) as string[]).includes(rawStatus)
          ? (rawStatus as OrderStatus)
          : undefined;

      const result = await OrderService.listOrders(page, limit, search, sortBy, sortOrder, status);
      return responseSuccess(res, 200, result);
    } catch (error) {
      next(error);
    }
  }

  static async checkout(req: Request, res: Response, next: NextFunction) {
    const { error, value } = checkoutSchema.validate(req.body);
    if (error) return responseError(res, 400, error.message);

    try {
      const customerId = await resolveCustomerId(req);
      const sessionId = req.headers['x-session-id'] as string | undefined;

      const order = await OrderService.checkoutFromCart({
        customerId,
        sessionId,
        shippingAddressId: value.shippingAddressId,
        couponCode: value.couponCode,
        promotionCode: value.promotionCode,
        currency: value.currency,
      });

      return responseSuccess(res, 201, order, 'Order placed successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v2/orders/checkout-direct
   * Signed-in-only checkout that takes items directly (product+size+color+
   * quantity) instead of reading a persisted backend cart — see
   * OrderService.checkoutDirect's doc comment for why this exists.
   */
  static async checkoutDirect(req: Request, res: Response, next: NextFunction) {
    const { error, value } = checkoutDirectSchema.validate(req.body);
    if (error) return responseError(res, 400, error.message);

    try {
      const customerId = await resolveCustomerId(req);
      if (!customerId || !req.user) return responseError(res, 401, 'Unauthorized');

      const order = await OrderService.checkoutDirect({
        customerId,
        userId: req.user.id,
        items: value.items,
        shippingAddressId: value.shippingAddressId,
        couponCode: value.couponCode,
        promotionCode: value.promotionCode,
        currency: value.currency,
      });

      return responseSuccess(res, 201, order, 'Order placed successfully');
    } catch (err) {
      next(err);
    }
  }

  static async getOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const order = await OrderService.getOrderDetails(
        req.params.id,
        await resolveOrderViewer(req),
      );
      return responseSuccess(res, 200, order);
    } catch (error) {
      next(error);
    }
  }

  static async getMyOrders(req: Request, res: Response, next: NextFunction) {
    try {
      const customerId = await resolveCustomerId(req);
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

  static async cancel(req: Request, res: Response, next: NextFunction) {
    try {
      const order = await OrderService.cancelOrder(req.params.id);
      return responseSuccess(res, 200, order, 'Order cancelled');
    } catch (error) {
      next(error);
    }
  }

  static async getSupplierOrders(req: Request, res: Response, next: NextFunction) {
    try {
      const orders = await OrderService.getSupplierOrders(req.params.id);
      return responseSuccess(res, 200, orders);
    } catch (error) {
      next(error);
    }
  }

  static async updateShipment(req: Request, res: Response, next: NextFunction) {
    try {
      const { status, trackingNumber } = req.body;
      const shipment = await OrderService.updateShipment(
        req.params.shipmentId,
        status,
        trackingNumber,
      );
      return responseSuccess(res, 200, shipment);
    } catch (error) {
      next(error);
    }
  }
}
