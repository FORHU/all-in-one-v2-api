import express from 'express';
import { ProductSyncController } from '../controllers/product-sync.controller';
import { authenticate, authorize, ADMIN_ROLES } from '../middleware/auth.middleware';

const router = express.Router();

// Enqueues supplier sync jobs — was previously public, which let anyone burn
// through supplier API rate limits.
router.post('/sync', authenticate, authorize(...ADMIN_ROLES), ProductSyncController.syncProducts);

export default router;
