import express from 'express';
import StorefrontController from './storefront.controller';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';

const router = express.Router();

// ─── Public Storefront Routes ────────────────────────────────────────────────
// GET /v2/storefront?pageType=HOME
// GET /v2/storefront?slug=black-friday-sale
// GET /v2/storefront?pageType=CATEGORY&contextType=CATEGORY&contextId=abc
router.get('/', StorefrontController.getPage);

// ─── Admin Page Management ──────────────────────────────────────────────────
router.post(
  '/pages',
  authenticate,
  requirePermission('catalog:write'),
  StorefrontController.createPage,
);
router.put(
  '/pages/:id',
  authenticate,
  requirePermission('catalog:write'),
  StorefrontController.updatePage,
);
router.delete(
  '/pages/:id',
  authenticate,
  requirePermission('catalog:delete'),
  StorefrontController.deletePage,
);

// ─── Admin Section Management ────────────────────────────────────────────────
router.post(
  '/',
  authenticate,
  requirePermission('catalog:write'),
  StorefrontController.createSection,
);
router.get(
  '/:id',
  authenticate,
  requirePermission('catalog:read'),
  StorefrontController.getSectionById,
);
router.put(
  '/:id',
  authenticate,
  requirePermission('catalog:write'),
  StorefrontController.updateSection,
);
router.delete(
  '/:id',
  authenticate,
  requirePermission('catalog:delete'),
  StorefrontController.deleteSection,
);

// ─── Admin Pinned Items Management ──────────────────────────────────────────
router.post(
  '/:sectionId/items',
  authenticate,
  requirePermission('catalog:write'),
  StorefrontController.addPinnedItem,
);
router.delete(
  '/:sectionId/items/:itemId',
  authenticate,
  requirePermission('catalog:write'),
  StorefrontController.removePinnedItem,
);

export default router;
