import express from 'express';
import PaymentController from './payment.controller';
import {
  authenticate,
  requirePermission,
  optionalAuthenticate,
} from '../../middleware/auth.middleware';

const router = express.Router();

// Optional auth: guests who checked out with a session cart still need to pay.
// Ownership of the order is verified in the service.
router.post('/intents', optionalAuthenticate, PaymentController.createIntent);

// Saved payment methods
router.post('/methods/setup-intent', authenticate, PaymentController.createSetupIntent);
router.get('/methods', authenticate, PaymentController.listPaymentMethods);
router.delete('/methods/:paymentMethodId', authenticate, PaymentController.detachPaymentMethod);

// Provider callback — must stay unauthenticated.
// TODO: this endpoint still trusts its payload. It needs HMAC signature
// verification against the raw request body before going live.
router.post('/webhooks/:provider?', PaymentController.handleWebhook);
router.get(
  '/:paymentId/events',
  authenticate,
  requirePermission('orders:read'),
  PaymentController.getPaymentEvents,
);
router.get(
  '/:paymentId/attempts',
  authenticate,
  requirePermission('orders:read'),
  PaymentController.getPaymentAttempts,
);

export default router;
