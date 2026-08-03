import express from 'express';
import StorefrontController from '../controllers/storefront.controller';
import { authenticate, authorize, ADMIN_ROLES } from '../middleware/auth.middleware';

const router = express.Router();

// ─── Public Storefront Routes ────────────────────────────────────────────────
// GET /v2/storefront?pageType=HOME
// GET /v2/storefront?slug=black-friday-sale
// GET /v2/storefront?pageType=CATEGORY&contextType=CATEGORY&contextId=abc
router.get('/', StorefrontController.getPage);

// ─── Admin Page Management ──────────────────────────────────────────────────
router.post('/pages', authenticate, authorize(...ADMIN_ROLES), StorefrontController.createPage);
router.put('/pages/:id', authenticate, authorize(...ADMIN_ROLES), StorefrontController.updatePage);
router.delete(
  '/pages/:id',
  authenticate,
  authorize(...ADMIN_ROLES),
  StorefrontController.deletePage,
);

// ─── Admin Section Management ────────────────────────────────────────────────
router.post('/', authenticate, authorize(...ADMIN_ROLES), StorefrontController.createSection);
router.get('/:id', authenticate, authorize(...ADMIN_ROLES), StorefrontController.getSectionById);
router.put('/:id', authenticate, authorize(...ADMIN_ROLES), StorefrontController.updateSection);
router.delete('/:id', authenticate, authorize(...ADMIN_ROLES), StorefrontController.deleteSection);

// ─── Admin Pinned Items Management ──────────────────────────────────────────
router.post(
  '/:sectionId/items',
  authenticate,
  authorize(...ADMIN_ROLES),
  StorefrontController.addPinnedItem,
);
router.delete(
  '/:sectionId/items/:itemId',
  authenticate,
  authorize(...ADMIN_ROLES),
  StorefrontController.removePinnedItem,
);

export default router;
