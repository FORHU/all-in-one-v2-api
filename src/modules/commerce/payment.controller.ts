/* eslint-disable no-console */
import { Request, Response, NextFunction } from 'express';
import PaymentService from './payment.service';
import { responseSuccess } from '../../helpers/response.helper';
import { resolveOrderViewer } from '../../helpers/requester.helper';
import crypto from 'crypto';
import Stripe from 'stripe';

const stripe = new Stripe((process.env.STRIPE_SECRET_KEY as string) || '', {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  apiVersion: '2026-07-29.dahlia' as any,
});

export default class PaymentController {
  static async createIntent(req: Request, res: Response, next: NextFunction) {
    try {
      const { orderId, gateway, channel, instrument, paymentMethodId, savePaymentMethod } =
        req.body;

      const payment = await PaymentService.createPaymentIntent({
        orderId,
        gateway,
        channel,
        instrument,
        paymentMethodId,
        savePaymentMethod,
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
      const rawBody = req.body.toString('utf8');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let parsedPayload: any;
      let eventType: string;

      if (provider === 'STRIPE') {
        const signature = req.headers['stripe-signature'] as string;
        const secret = process.env.STRIPE_WEBHOOK_SECRET;

        if (!signature || !secret) {
          console.warn('⚠️ Webhook Warning: Missing stripe-signature or webhook secret');
          return res.status(400).json({ message: 'Webhook Error: Missing signature or secret' });
        }

        try {
          parsedPayload = stripe.webhooks.constructEvent(rawBody, signature, secret);
          eventType = parsedPayload.type;
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          console.error(`❌ Webhook signature verification failed: ${errorMessage}`);
          return res.status(400).json({ message: `Webhook Error: ${errorMessage}` });
        }
      } else {
        // Fallback for PayMongo / Others (Generic HMAC)
        const signature = (req.headers['paymongo-signature'] ||
          req.headers['x-signature']) as string;
        const secret = process.env.WEBHOOK_SECRET;

        if (!signature || !secret) {
          console.warn('⚠️ Webhook Warning: Missing signature or webhook secret');
          return res.status(400).json({ message: 'Webhook Error: Missing signature or secret' });
        }

        const expectedHmac = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

        if (!signature.includes(expectedHmac)) {
          console.error('❌ Webhook signature verification failed');
          return res.status(400).json({ message: 'Webhook Error: Invalid signature' });
        }

        parsedPayload = JSON.parse(rawBody);
        eventType = parsedPayload?.data?.attributes?.type || parsedPayload?.type || 'payment.event';
      }

      const result = await PaymentService.handleWebhook(provider, eventType, parsedPayload);
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

  static async createSetupIntent(req: Request, res: Response, next: NextFunction) {
    try {
      const types = req.body.types || ['card'];
      const intent = await PaymentService.createSetupIntent(await resolveOrderViewer(req), types);
      return responseSuccess(res, 201, intent, 'Setup intent created');
    } catch (error) {
      next(error);
    }
  }

  static async listPaymentMethods(req: Request, res: Response, next: NextFunction) {
    try {
      const type = (req.query.type as Stripe.PaymentMethodListParams.Type) || 'card';
      const methods = await PaymentService.listPaymentMethods(await resolveOrderViewer(req), type);
      return responseSuccess(res, 200, methods);
    } catch (error) {
      next(error);
    }
  }

  static async detachPaymentMethod(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await PaymentService.detachPaymentMethod(
        await resolveOrderViewer(req),
        req.params.paymentMethodId,
      );
      return responseSuccess(res, 200, result, 'Payment method detached');
    } catch (error) {
      next(error);
    }
  }
}
