import express from 'express';
import CollectionController from './collection.controller';
import {
  authenticate,
  optionalAuthenticate,
  requirePermission,
} from '../../middleware/auth.middleware';

const router = express.Router();

// Public storefront routes — optionalAuthenticate populates req.user when the
// admin panel's Bearer token is present (so it keeps seeing unpublished
// collections) without requiring auth for anonymous storefront visitors.
router.get('/', optionalAuthenticate, CollectionController.list);
router.get('/slug/:slug', optionalAuthenticate, CollectionController.getBySlug);
router.get('/:id', optionalAuthenticate, CollectionController.getById);

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
