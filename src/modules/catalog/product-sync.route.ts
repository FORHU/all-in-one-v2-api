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

// Re-queues every already-imported product for this tenant (optionally
// scoped to one supplier) — for backfilling/refreshing stock without having
// to know every externalId up front.
router.post(
  '/resync-all',
  authenticate,
  requirePermission('catalog:write'),
  ProductSyncController.resyncAll,
);

// Synchronous single-product refresh — for a per-row "Refresh" action where
// the admin wants an immediate result, not a queued background job.
router.post(
  '/:id/resync',
  authenticate,
  requirePermission('catalog:write'),
  ProductSyncController.resyncOne,
);

export default router;
