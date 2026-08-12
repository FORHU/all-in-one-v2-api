import express from 'express';
import InventoryController from './inventory.controller';
import { authenticate, authorize, ADMIN_ROLES } from '../../middleware/auth.middleware';

const router = express.Router();

// Admin location CRUD routes
router.get(
  '/locations',
  authenticate,
  authorize(...ADMIN_ROLES),
  InventoryController.listLocations,
);
router.get(
  '/locations/:id',
  authenticate,
  authorize(...ADMIN_ROLES),
  InventoryController.getLocationById,
);
router.post(
  '/locations',
  authenticate,
  authorize(...ADMIN_ROLES),
  InventoryController.createLocation,
);
router.put(
  '/locations/:id',
  authenticate,
  authorize(...ADMIN_ROLES),
  InventoryController.updateLocation,
);

// Stock level management routes
router.get(
  '/variant/:variantId',
  authenticate,
  authorize(...ADMIN_ROLES),
  InventoryController.getVariantStock,
);
router.post('/stock', authenticate, authorize(...ADMIN_ROLES), InventoryController.setStock);
router.get(
  '/transactions',
  authenticate,
  authorize(...ADMIN_ROLES),
  InventoryController.getTransactions,
);

export default router;
