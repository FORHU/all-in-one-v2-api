import express from 'express';
import CollectionController from '../controllers/collection.controller';
import { authenticate, authorize, ADMIN_ROLES } from '../middleware/auth.middleware';

const router = express.Router();

// Public storefront routes
router.get('/', CollectionController.list);
router.get('/slug/:slug', CollectionController.getBySlug);
router.get('/:id', CollectionController.getById);

// Admin collection routes
router.post('/', authenticate, authorize(...ADMIN_ROLES), CollectionController.create);
router.put('/:id', authenticate, authorize(...ADMIN_ROLES), CollectionController.update);
router.delete('/:id', authenticate, authorize(...ADMIN_ROLES), CollectionController.delete);

// Admin collection items management routes
router.post(
  '/:collectionId/items',
  authenticate,
  authorize(...ADMIN_ROLES),
  CollectionController.addItem,
);
router.put(
  '/:collectionId/items/reorder',
  authenticate,
  authorize(...ADMIN_ROLES),
  CollectionController.reorderItems,
);
router.put(
  '/:collectionId/items/:itemId',
  authenticate,
  authorize(...ADMIN_ROLES),
  CollectionController.updateItem,
);
router.delete(
  '/:collectionId/items/:itemId',
  authenticate,
  authorize(...ADMIN_ROLES),
  CollectionController.removeItem,
);

export default router;
