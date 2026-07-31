import express from 'express';
import SizeGuideController from '../controllers/size-guide.controller';
import { authenticate, authorize, ADMIN_ROLES } from '../middleware/auth.middleware';

const router = express.Router();

// Public storefront routes
router.get('/product/:productId', SizeGuideController.getByProduct);
router.get('/:id', SizeGuideController.getById);

// Admin size guide CRUD routes
router.post('/', authenticate, authorize(...ADMIN_ROLES), SizeGuideController.create);
router.put('/:id', authenticate, authorize(...ADMIN_ROLES), SizeGuideController.update);
router.delete('/:id', authenticate, authorize(...ADMIN_ROLES), SizeGuideController.delete);

// Admin size entry CRUD routes
router.post(
  '/:guideId/entries',
  authenticate,
  authorize(...ADMIN_ROLES),
  SizeGuideController.addEntry,
);
router.put(
  '/entries/:entryId',
  authenticate,
  authorize(...ADMIN_ROLES),
  SizeGuideController.updateEntry,
);
router.delete(
  '/entries/:entryId',
  authenticate,
  authorize(...ADMIN_ROLES),
  SizeGuideController.deleteEntry,
);

// Admin variant linking route
router.post(
  '/link-variant',
  authenticate,
  authorize(...ADMIN_ROLES),
  SizeGuideController.linkVariant,
);

export default router;
