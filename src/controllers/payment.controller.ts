import { Request, Response, NextFunction } from 'express';
import PaymentService from '../services/payment.service';
import { responseSuccess } from '../helpers/response.helper';

export default class PaymentController {
  static async createIntent(req: Request, res: Response, next: NextFunction) {
    try {
      const { orderId, amount, currency, provider = 'PAYMONGO', paymentMethod } = req.body;

      const payment = await PaymentService.createPaymentIntent({
        orderId,
        amount: Number(amount),
        currency,
        provider,
        paymentMethod,
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
}
