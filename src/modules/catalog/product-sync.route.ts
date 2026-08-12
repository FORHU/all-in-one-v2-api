import express from 'express';
import { ProductSyncController } from './product-sync.controller';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';

const router = express.Router();

// Enqueues supplier sync jobs — was previously public, which let anyone burn
// through supplier API rate limits.
router.post(
  '/sync',
  authenticate,
  requirePermission('catalog:write'),
  ProductSyncController.syncProducts,
);

export default router;
