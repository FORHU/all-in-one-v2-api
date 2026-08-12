import express from 'express';
import InventoryController from './inventory.controller';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';

const router = express.Router();

// Admin location CRUD routes
router.get(
  '/locations',
  authenticate,
  requirePermission('catalog:read'),
  InventoryController.listLocations,
);
router.get(
  '/locations/:id',
  authenticate,
  requirePermission('catalog:read'),
  InventoryController.getLocationById,
);
router.post(
  '/locations',
  authenticate,
  requirePermission('catalog:write'),
  InventoryController.createLocation,
);
router.put(
  '/locations/:id',
  authenticate,
  requirePermission('catalog:write'),
  InventoryController.updateLocation,
);

// Stock level management routes
router.get(
  '/variant/:variantId',
  authenticate,
  requirePermission('catalog:read'),
  InventoryController.getVariantStock,
);
router.post(
  '/stock',
  authenticate,
  requirePermission('catalog:write'),
  InventoryController.setStock,
);
router.get(
  '/transactions',
  authenticate,
  requirePermission('catalog:read'),
  InventoryController.getTransactions,
);

export default router;
