import express from 'express';
import OrderController from './order.controller';
import {
  authenticate,
  optionalAuthenticate,
  requirePermission,
} from '../../middleware/auth.middleware';

const router = express.Router();

// Listing orders is an admin operation, same as GET /api/v2/customers.
router.get('/', authenticate, requirePermission('orders:read'), OrderController.index);

// Guests may check out with an x-session-id cart, so auth is optional here.
router.post('/checkout', optionalAuthenticate, OrderController.checkout);

router.get('/my-orders', authenticate, OrderController.getMyOrders);

// Guests can view an order they placed by presenting the same x-session-id.
// Ownership is enforced in the service, which 404s for everyone else.
router.get('/:id', optionalAuthenticate, OrderController.getOrder);
router.patch(
  '/:id/status',
  authenticate,
  requirePermission('orders:write'),
  OrderController.updateStatus,
);
router.get(
  '/:id/supplier-orders',
  authenticate,
  requirePermission('orders:read'),
  OrderController.getSupplierOrders,
);
router.put(
  '/shipments/:shipmentId',
  authenticate,
  requirePermission('orders:write'),
  OrderController.updateShipment,
);

export default router;
