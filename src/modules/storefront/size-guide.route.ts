import express from 'express';
import SizeGuideController from './size-guide.controller';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';

const router = express.Router();

// Public storefront routes
router.get('/product/:productId', SizeGuideController.getByProduct);
router.get('/:id', SizeGuideController.getById);

// Admin size guide CRUD routes
router.post('/', authenticate, requirePermission('catalog:write'), SizeGuideController.create);
router.put('/:id', authenticate, requirePermission('catalog:write'), SizeGuideController.update);
router.delete(
  '/:id',
  authenticate,
  requirePermission('catalog:delete'),
  SizeGuideController.delete,
);

// Admin size entry CRUD routes
router.post(
  '/:guideId/entries',
  authenticate,
  requirePermission('catalog:write'),
  SizeGuideController.addEntry,
);
router.put(
  '/entries/:entryId',
  authenticate,
  requirePermission('catalog:write'),
  SizeGuideController.updateEntry,
);
router.delete(
  '/entries/:entryId',
  authenticate,
  requirePermission('catalog:delete'),
  SizeGuideController.deleteEntry,
);

// Admin variant linking route
router.post(
  '/link-variant',
  authenticate,
  requirePermission('catalog:write'),
  SizeGuideController.linkVariant,
);

export default router;
