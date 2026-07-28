import express from 'express';
import OrderController from '../controllers/order.controller';
import { authenticate, optionalAuthenticate, authorize, ADMIN_ROLES } from '../middleware/auth.middleware';

const router = express.Router();

// Guests may check out with an x-session-id cart, so auth is optional here.
router.post('/checkout', optionalAuthenticate, OrderController.checkout);

router.get('/my-orders', authenticate, OrderController.getMyOrders);

// Guests can view an order they placed by presenting the same x-session-id.
// Ownership is enforced in the service, which 404s for everyone else.
router.get('/:id', optionalAuthenticate, OrderController.getOrder);
router.patch('/:id/status', authenticate, authorize(...ADMIN_ROLES), OrderController.updateStatus);

export default router;
