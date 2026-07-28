import express from 'express';
import PaymentController from '../controllers/payment.controller';
import { optionalAuthenticate } from '../middleware/auth.middleware';

const router = express.Router();

// Optional auth: guests who checked out with a session cart still need to pay.
// Ownership of the order is verified in the service.
router.post('/intents', optionalAuthenticate, PaymentController.createIntent);

// Provider callback — must stay unauthenticated.
// TODO: this endpoint still trusts its payload. It needs HMAC signature
// verification against the raw request body before going live.
router.post('/webhooks/:provider?', PaymentController.handleWebhook);

export default router;
