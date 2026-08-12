import express from 'express';
import CollectionController from './collection.controller';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';

const router = express.Router();

// Public storefront routes
router.get('/', CollectionController.list);
router.get('/slug/:slug', CollectionController.getBySlug);
router.get('/:id', CollectionController.getById);

// Admin collection routes
router.post('/', authenticate, requirePermission('catalog:write'), CollectionController.create);
router.put('/:id', authenticate, requirePermission('catalog:write'), CollectionController.update);
router.delete(
  '/:id',
  authenticate,
  requirePermission('catalog:delete'),
  CollectionController.delete,
);

// Admin collection items management routes
router.post(
  '/:collectionId/items',
  authenticate,
  requirePermission('catalog:write'),
  CollectionController.addItem,
);
router.put(
  '/:collectionId/items/reorder',
  authenticate,
  requirePermission('catalog:write'),
  CollectionController.reorderItems,
);
router.put(
  '/:collectionId/items/:itemId',
  authenticate,
  requirePermission('catalog:write'),
  CollectionController.updateItem,
);
router.delete(
  '/:collectionId/items/:itemId',
  authenticate,
  requirePermission('catalog:delete'),
  CollectionController.removeItem,
);

export default router;
