import express from 'express';
import OrderController from '../controllers/order.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = express.Router();

router.post('/checkout', OrderController.checkout);
router.get('/my-orders', authenticate, OrderController.getMyOrders);
router.get('/:id', OrderController.getOrder);
router.patch('/:id/status', authenticate, OrderController.updateStatus);

export default router;
