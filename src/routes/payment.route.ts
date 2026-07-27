import express from 'express';
import PaymentController from '../controllers/payment.controller';

const router = express.Router();

router.post('/intents', PaymentController.createIntent);
router.post('/webhooks/:provider?', PaymentController.handleWebhook);

export default router;
