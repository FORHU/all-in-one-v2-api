import { Request, Response, NextFunction } from 'express';
import PaymentService from '../services/payment.service';
import { responseSuccess } from '../helpers/response.helper';
import { resolveOrderViewer } from '../helpers/requester.helper';

export default class PaymentController {
  static async createIntent(req: Request, res: Response, next: NextFunction) {
    try {
      const { orderId, gateway, channel, instrument } = req.body;

      const payment = await PaymentService.createPaymentIntent({
        orderId,
        gateway,
        channel,
        instrument,
        requester: await resolveOrderViewer(req),
      });

      return responseSuccess(res, 201, payment, 'Payment intent created');
    } catch (error) {
      next(error);
    }
  }

  static async handleWebhook(req: Request, res: Response, next: NextFunction) {
    try {
      const provider = (req.params.provider || 'PAYMONGO').toUpperCase();
      const eventType = req.body?.data?.attributes?.type || req.body?.type || 'payment.event';

      const result = await PaymentService.handleWebhook(provider, eventType, req.body);
      return responseSuccess(res, 200, result, 'Webhook processed successfully');
    } catch (error) {
      next(error);
    }
  }

  static async getPaymentEvents(req: Request, res: Response, next: NextFunction) {
    try {
      const events = await PaymentService.getPaymentEvents(req.params.paymentId);
      return responseSuccess(res, 200, events);
    } catch (error) {
      next(error);
    }
  }

  static async getPaymentAttempts(req: Request, res: Response, next: NextFunction) {
    try {
      const attempts = await PaymentService.getPaymentAttempts(req.params.paymentId);
      return responseSuccess(res, 200, attempts);
    } catch (error) {
      next(error);
    }
  }
}
