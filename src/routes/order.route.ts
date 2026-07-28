import express from 'express';
import OrderController from '../controllers/order.controller';
import { authenticate, optionalAuthenticate, authorize, ADMIN_ROLES } from '../middleware/auth.middleware';

const router = express.Router();

// Guests may check out with an x-session-id cart, so auth is optional here.
router.post('/checkout', optionalAuthenticate, OrderController.checkout);

router.get('/my-orders', authenticate, OrderController.getMyOrders);
router.get('/:id', authenticate, OrderController.getOrder);
router.patch('/:id/status', authenticate, authorize(...ADMIN_ROLES), OrderController.updateStatus);

export default router;
